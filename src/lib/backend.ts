// GymSphere data layer, backed by Supabase (Postgres + Auth + Edge Functions + RLS).
//
// The UI reads everything through loadDb(), a synchronous in-memory snapshot of the rows the
// signed-in user is allowed to see. refreshDb() rebuilds that snapshot from Supabase (row level
// security decides what comes back) and is called by the useDb() hook in src/api/db.ts after every
// change. Every write goes to Supabase: directly for simple table edits that RLS allows, through
// SQL functions (rpc) for business rules, and through Edge Functions for anything that needs the
// service role (creating users, QR signing, attendance scans).
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type {
  AppUser, AttendanceAudit, Attendance, AttendanceRequest, BodyMetric, ChangeRequest, ChurnAlert,
  Equipment, Gym, Member, Notification, Payment, Plan, Rating, SalaryPayment, Session, ShiftType,
  Subscription, Trainer, TrainerAttendance, UserRole, GymOption, Announcement, MemberPlan, MemberPlanLog,
  PointsInfo, RenewalQuote,
} from "../types";

const SESSION_KEY = "gymsphere.session.v3";

export interface Db {
  gyms: Gym[];
  users: AppUser[];
  trainers: Trainer[];
  members: Member[];
  plans: Plan[];
  subscriptions: Subscription[];
  payments: Payment[];
  attendance: Attendance[];
  equipment: Equipment[];
  ratings: Rating[];
  changeRequests: ChangeRequest[];
  salaryPayments: SalaryPayment[];
  bodyMetrics: BodyMetric[];
  notifications: Notification[];
  churnAlerts: ChurnAlert[];
  attendanceAudits: AttendanceAudit[];
  attendanceRequests: AttendanceRequest[];
  trainerAttendance: TrainerAttendance[];
  announcements: Announcement[];
  memberPlans: MemberPlan[];
  memberPlanLogs: MemberPlanLog[];
  idCounters: Record<string, number>;
}

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------

function uid(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function todayStr(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysPublic(dateStr: string, days: number): string {
  return addDays(dateStr, days);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return todayStr(d);
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime();
  return Math.round(ms / 86400000);
}

export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

const GENERIC_ERROR = "Incorrect ID or password";
const SERVER_ERROR = "We could not reach the server. Check your connection and try again.";

interface PgError {
  message: string;
  code?: string;
}

// Throws a readable Error for a failed Supabase call. Messages raised by our SQL triggers
// (for example "Trainer has reached maximum capacity") are already written for people.
function check(error: PgError | null, fallback = "Something went wrong. Please try again."): void {
  if (!error) return;
  if (error.code === "42501" || /row-level security/i.test(error.message)) {
    throw new Error("You do not have permission to do this.");
  }
  throw new Error(error.message || fallback);
}

// Calls an Edge Function and always returns the parsed JSON body, including for 4xx and 5xx replies.
async function invokeFn<T = Record<string, unknown>>(
  name: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data: T & { error?: string } }> {
  // Send the signed-in person's token explicitly (falls back to the anon key for login/register).
  const { data: auth } = await supabase.auth.getSession();
  const headers = auth.session ? { Authorization: `Bearer ${auth.session.access_token}` } : undefined;
  const { data, error } = await supabase.functions.invoke(name, { body, headers });
  if (!error) return { ok: true, data: (data ?? {}) as T & { error?: string } };
  if (error instanceof FunctionsHttpError) {
    try {
      return { ok: false, data: (await error.context.json()) as T & { error?: string } };
    } catch {
      /* fall through */
    }
  }
  return { ok: false, data: { error: SERVER_ERROR } as T & { error?: string } };
}

// Reads every row of a table, 1000 at a time (PostgREST's page limit).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll(table: string, orderBy: string): Promise<any[]> {
  const pageSize = 1000;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderBy, { ascending: true })
      .range(from, from + pageSize - 1);
    check(error);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Row mappers (database snake_case to app camelCase)
// ---------------------------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
const mapGym = (r: any): Gym => ({
  gymId: r.gym_id, code: r.code, name: r.name, address: r.address ?? "",
  latitude: r.latitude, longitude: r.longitude, radiusM: r.radius_m,
  closingTime: String(r.closing_time ?? "22:00").slice(0, 5),
  requireCheckoutApproval: !!r.require_checkout_approval,
  pointsPerVisit: r.points_per_visit ?? 10, pointValue: Number(r.point_value ?? 0.5),
  streakBonus: r.streak_bonus ?? 50, maxDiscountPct: r.max_discount_pct ?? 30, createdAt: r.created_at,
});
const mapUser = (r: any): AppUser => ({
  userId: r.user_id, gymId: r.gym_id, publicId: r.public_id, role: r.role, name: r.name,
  age: r.age, gender: r.gender, phone: r.phone, email: r.email, password: "",
  mustChangePassword: !!r.must_change_password, tempPasswordExpiry: r.temp_password_expiry,
  failedAttempts: r.failed_attempts ?? 0, lockedUntil: r.locked_until, isActive: !!r.is_active,
  createdAt: r.created_at,
});
const mapTrainer = (r: any): Trainer => ({
  userId: r.user_id, gymId: r.gym_id, salary: Number(r.salary), specialty: r.specialty ?? "",
  shift: r.shift, maxCapacity: r.max_capacity, joinedOn: r.joined_on,
});
const mapMember = (r: any): Member => ({
  userId: r.user_id, gymId: r.gym_id, assignedTrainerId: r.assigned_trainer_id, goal: r.goal ?? "",
  preferredShift: r.preferred_shift, joinedOn: r.joined_on, waitlisted: !!r.waitlisted,
});
const mapPlan = (r: any): Plan => ({
  planId: r.plan_id, gymId: r.gym_id, name: r.name, durationDays: r.duration_days, price: Number(r.price),
});
const mapSub = (r: any): Subscription => ({
  subId: r.sub_id, gymId: r.gym_id, memberId: r.member_id, planId: r.plan_id,
  startDate: r.start_date, endDate: r.end_date, status: r.status,
});
const mapPayment = (r: any): Payment => ({
  paymentId: r.payment_id, gymId: r.gym_id, subId: r.sub_id, amount: Number(r.amount),
  mode: r.mode, paidAt: r.paid_at, reference: r.reference ?? "",
});
const mapAttendance = (r: any): Attendance => ({
  attId: r.att_id, gymId: r.gym_id, memberId: r.member_id, attendanceDate: r.attendance_date,
  checkIn: r.check_in, checkOut: r.check_out, inMethod: r.in_method, outMethod: r.out_method,
  distanceM: r.distance_m, editedBy: r.edited_by,
});
const mapEquipment = (r: any): Equipment => ({
  equipmentId: r.equipment_id, gymId: r.gym_id, name: r.name,
  conditionScore: Number(r.condition_score), lastServiced: r.last_serviced,
});
const mapRating = (r: any): Rating => ({
  ratingId: r.rating_id, gymId: r.gym_id, memberId: r.member_id, trainerId: r.trainer_id,
  equipmentId: r.equipment_id, score: r.score, comment: r.comment ?? "",
  periodStart: r.period_start, createdAt: r.created_at,
});
const mapChangeRequest = (r: any): ChangeRequest => ({
  reqId: r.req_id, gymId: r.gym_id, memberId: r.member_id, fromTrainer: r.from_trainer,
  toTrainer: r.to_trainer, reason: r.reason ?? "", status: r.status, decidedBy: r.decided_by,
  createdAt: r.created_at, submittedBy: (r.submitted_by ?? "member") as UserRole,
});
const mapSalary = (r: any): SalaryPayment => ({
  id: r.id, gymId: r.gym_id, trainerId: r.trainer_id, month: r.month, amount: Number(r.amount),
  paidOn: r.paid_on,
});
const mapMetric = (r: any): BodyMetric => ({
  id: r.id, gymId: r.gym_id, memberId: r.member_id, recordedOn: r.recorded_on,
  weightKg: r.weight_kg == null ? null : Number(r.weight_kg),
  waistCm: r.waist_cm == null ? null : Number(r.waist_cm),
});
const mapNotification = (r: any): Notification => ({
  id: r.id, gymId: r.gym_id, userId: r.user_id, type: r.type, message: r.message,
  isRead: !!r.is_read, createdAt: r.created_at,
});
const mapAudit = (r: any): AttendanceAudit => ({
  id: r.id, gymId: r.gym_id, attId: r.att_id, changedBy: r.changed_by,
  oldValues: r.old_values ?? {}, newValues: r.new_values ?? {}, changedAt: r.changed_at,
});
const mapAttRequest = (r: any): AttendanceRequest => ({
  requestId: r.request_id, gymId: r.gym_id, memberId: r.member_id, trainerId: r.trainer_id,
  method: r.method, requestedAt: r.requested_at, latitude: r.latitude, longitude: r.longitude,
  accuracyM: r.accuracy_m, distanceM: r.distance_m, status: r.status, decidedBy: r.decided_by,
  decidedAt: r.decided_at, rejectReason: r.reject_reason, attId: r.att_id,
});
const mapTrainerAttendance = (r: any): TrainerAttendance => ({
  id: r.id, gymId: r.gym_id, trainerId: r.trainer_id, attendanceDate: r.attendance_date,
  checkIn: r.check_in, checkOut: r.check_out, status: r.status, method: r.method ?? "self",
  latitude: r.latitude, longitude: r.longitude, distanceM: r.distance_m, decidedBy: r.decided_by,
  decidedAt: r.decided_at, rejectReason: r.reject_reason,
});
const mapAnnouncement = (r: any): Announcement => ({
  id: r.id, gymId: r.gym_id, title: r.title ?? "", message: r.message, audience: r.audience,
  sentTo: r.sent_to ?? 0, createdAt: r.created_at,
});
const mapMemberPlan = (r: any): MemberPlan => ({
  id: r.id, gymId: r.gym_id, memberId: r.member_id, createdBy: r.created_by, kind: r.kind,
  title: r.title, content: r.content, createdAt: r.created_at,
});
const mapPlanLog = (r: any): MemberPlanLog => ({
  id: r.id, gymId: r.gym_id, planId: r.plan_id, memberId: r.member_id, logDate: r.log_date,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------------------------
// In-memory snapshot of the signed-in user's data
// ---------------------------------------------------------------------------------------------

function emptyDb(): Db {
  return {
    gyms: [], users: [], trainers: [], members: [], plans: [], subscriptions: [], payments: [],
    attendance: [], equipment: [], ratings: [], changeRequests: [], salaryPayments: [],
    bodyMetrics: [], notifications: [], churnAlerts: [], attendanceAudits: [],
    attendanceRequests: [], trainerAttendance: [], announcements: [], memberPlans: [], memberPlanLogs: [],
    idCounters: {},
  };
}

let cache: Db = emptyDb();

function loadDb(): Db {
  return cache;
}

// Kept so older imports still compile. Data is saved in Supabase, never in the browser.
function saveDb(_db: Db): void {
  /* no-op */
}

// Marks subscriptions past their end date as expired, in the snapshot only (the nightly database
// job does the same in Postgres).
export function updateSubscriptionStatuses(db: Db) {
  const today = todayStr();
  for (const s of db.subscriptions) {
    if (s.status === "active" && s.endDate < today) s.status = "expired";
  }
}

let refreshing: Promise<Db> | null = null;

// Rebuilds the snapshot from Supabase. Concurrent calls share one round trip.
export function refreshDb(): Promise<Db> {
  if (refreshing) return refreshing;
  refreshing = doRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function doRefresh(): Promise<Db> {
  const session = getSession();
  if (!session) {
    cache = emptyDb();
    return cache;
  }
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    // The Supabase sign-in expired or was revoked: send the person back to the login screen.
    setSession(null);
    cache = emptyDb();
    window.location.assign(import.meta.env.BASE_URL || "/");
    throw new Error("Your session expired. Please sign in again.");
  }

  const [
    gyms, users, trainers, members, plans, subs, payments, attendance, equipment, ratings,
    changeRequests, salary, metrics, notifications, audits, attRequests, trainerAtt,
    announcements, memberPlans, planLogs,
  ] = await Promise.all([
    fetchAll("gym", "gym_id"), fetchAll("app_user", "user_id"), fetchAll("trainer", "user_id"),
    fetchAll("member", "user_id"), fetchAll("plan", "plan_id"), fetchAll("subscription", "sub_id"),
    fetchAll("payment", "payment_id"), fetchAll("attendance", "att_id"),
    fetchAll("equipment", "equipment_id"), fetchAll("rating", "rating_id"),
    fetchAll("change_request", "req_id"), fetchAll("salary_payment", "id"),
    fetchAll("body_metric", "id"), fetchAll("notification", "id"),
    fetchAll("attendance_audit", "id"), fetchAll("attendance_request", "request_id"),
    fetchAll("trainer_attendance", "id").catch(() => []),
    fetchAll("announcement", "id").catch(() => []),
    fetchAll("member_plan", "id").catch(() => []),
    fetchAll("member_plan_log", "id").catch(() => []),
  ]);

  const next = emptyDb();
  next.gyms = gyms.map(mapGym);
  next.users = users.map(mapUser);
  next.trainers = trainers.map(mapTrainer);
  next.members = members.map(mapMember);
  next.plans = plans.map(mapPlan);
  next.subscriptions = subs.map(mapSub);
  next.payments = payments.map(mapPayment);
  next.attendance = attendance.map(mapAttendance);
  next.equipment = equipment.map(mapEquipment);
  next.ratings = ratings.map(mapRating);
  next.changeRequests = changeRequests.map(mapChangeRequest);
  next.salaryPayments = salary.map(mapSalary);
  next.bodyMetrics = metrics.map(mapMetric);
  next.notifications = notifications.map(mapNotification);
  next.attendanceAudits = audits.map(mapAudit);
  next.attendanceRequests = attRequests.map(mapAttRequest);
  next.trainerAttendance = trainerAtt.map(mapTrainerAttendance);
  next.announcements = announcements.map(mapAnnouncement);
  next.memberPlans = memberPlans.map(mapMemberPlan);
  next.memberPlanLogs = planLogs.map(mapPlanLog);
  updateSubscriptionStatuses(next);
  if (session.role !== "member") recomputeChurnAlertsInto(next, session.gymId);
  cache = next;
  return cache;
}

// ---------------------------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------------------------

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function setSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable: the Supabase session still works for this tab */
  }
}

export function logout() {
  setSession(null);
  cache = emptyDb();
  void supabase.auth.signOut();
}

// Looks up the app_user row for a Supabase Auth user in the given gym. An owner has one row per gym.
async function buildSession(authId: string, gymId?: string): Promise<Session | null> {
  let query = supabase
    .from("app_user")
    .select("user_id, gym_id, public_id, role, name, must_change_password, temp_password_expiry, is_active")
    .eq("auth_id", authId);
  if (gymId) query = query.eq("gym_id", gymId);
  const { data, error } = await query.limit(1).maybeSingle();
  check(error);
  if (!data || !data.is_active) return null;
  return {
    authId, gymId: data.gym_id, userId: data.user_id, publicId: data.public_id, role: data.role,
    name: data.name, mustChangePassword: !!data.must_change_password,
  };
}

// Called once when the app starts. Restores the person's session, including after a Google redirect.
export async function restoreSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    setSession(null);
    return null;
  }
  const activeGym = data.session.user.app_metadata?.gym_id as string | undefined;
  const stored = getSession();
  if (stored && stored.authId === data.session.user.id && (!activeGym || stored.gymId === activeGym)) {
    return stored;
  }
  const built = await buildSession(data.session.user.id, activeGym);
  if (!built) {
    await supabase.auth.signOut();
    setSession(null);
    try {
      sessionStorage.setItem(
        "gymsphere.loginError",
        "This Google account is not registered with any gym. Ask your gym owner to add your email, or register your gym.",
      );
    } catch { /* storage unavailable */ }
    return null;
  }
  setSession(built);
  return built;
}

// ---------------------------------------------------------------------------------------------
// Gyms: the login dropdown, switching between an owner's gyms, adding and deleting
// ---------------------------------------------------------------------------------------------

// Every gym, for the dropdown on the login screen. Read fresh each time, so renames show up.
export async function listPublicGyms(): Promise<GymOption[]> {
  const { data, error } = await supabase.rpc("public_gyms");
  check(error);
  return ((data ?? []) as { gym_id: string; name: string }[]).map((g) => ({ gymId: g.gym_id, name: g.name }));
}

// The gyms the signed-in person belongs to (an owner can have several).
export async function listMyGyms(): Promise<GymOption[]> {
  const { data, error } = await supabase.rpc("my_gyms");
  check(error);
  return ((data ?? []) as { gym_id: string; name: string }[]).map((g) => ({ gymId: g.gym_id, name: g.name }));
}

// After the server changes the active gym, pull a fresh token and rebuild the session around it.
async function adoptActiveGym(gymId: string): Promise<Session> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session) throw new Error("Please sign in again.");
  cache = emptyDb();
  const session = await buildSession(data.session.user.id, gymId);
  if (!session) throw new Error("You do not have access to that gym.");
  setSession(session);
  return session;
}

export async function switchGym(gymId: string): Promise<Session> {
  const { ok, data } = await invokeFn("switch-gym", { gymId });
  if (!ok) throw new Error(data.error ?? "We could not switch gyms. Please try again.");
  return adoptActiveGym(gymId);
}

// Adds another gym for the signed-in owner and switches to it.
export async function createGym(gymName: string, address: string): Promise<Session> {
  const { ok, data } = await invokeFn<{ gymId?: string }>("create-gym", { gymName, address });
  if (!ok || !data.gymId) throw new Error(data.error ?? "We could not create the gym. Please try again.");
  return adoptActiveGym(data.gymId);
}

// ---------------------------------------------------------------------------------------------
// Auth and registration
// ---------------------------------------------------------------------------------------------

export interface RegisterGymInput {
  gymName: string;
  address: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerAge?: number;
  ownerPhone?: string;
}

export async function registerGym(input: RegisterGymInput): Promise<{ gymCode: string; ownerId: string }> {
  const { ok, data } = await invokeFn<{ gymCode: string; ownerId: string }>("register-gym", { ...input });
  if (!ok || !data.gymCode) throw new Error(data.error ?? "We could not complete registration.");
  return { gymCode: data.gymCode, ownerId: data.ownerId };
}

export interface LoginInput {
  /** The gym picked in the dropdown */
  gymId: string;
  /** User ID (M2601), email address or mobile number */
  identifier: string;
  password: string;
}

export async function login(input: LoginInput): Promise<Session> {
  const { ok, data } = await invokeFn<{
    session?: { access_token: string; refresh_token: string; user: { id: string } };
  }>("login", { ...input });
  if (!ok || !data.session) throw new Error(data.error ?? GENERIC_ERROR);

  const { error } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (error) throw new Error(GENERIC_ERROR);

  const { data: row } = await supabase
    .from("app_user")
    .select("must_change_password, temp_password_expiry")
    .eq("auth_id", data.session.user.id)
    .maybeSingle();
  if (row?.must_change_password && row.temp_password_expiry && new Date(row.temp_password_expiry) < new Date()) {
    await supabase.auth.signOut();
    throw new Error("Your temporary password has expired. Ask the owner to reset it.");
  }

  const session = await buildSession(data.session.user.id);
  if (!session) {
    await supabase.auth.signOut();
    throw new Error(GENERIC_ERROR);
  }
  setSession(session);
  return session;
}

// Starts Google sign-in. The browser leaves the app and returns signed in (see restoreSession).
// Needs the Google provider and the custom access token hook enabled in the Supabase dashboard.
export async function startGoogleSignIn(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw new Error("Google sign-in is not turned on yet. Enable the Google provider in Supabase (Authentication → Providers).");
}

export async function changePassword(userId: string, newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message || "We could not update your password. Please try again.");
  const { error: rowError } = await supabase
    .from("app_user")
    .update({ must_change_password: false, temp_password_expiry: null })
    .eq("user_id", userId);
  check(rowError, "We could not update your password. Please try again.");
  const session = getSession();
  if (session) setSession({ ...session, mustChangePassword: false });
}

export async function requestPasswordReset(email: string): Promise<void> {
  // The reply is the same whether or not the email exists, so this cannot be used to find accounts.
  await supabase.auth
    .resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + window.location.pathname })
    .catch(() => undefined);
}

// ---------------------------------------------------------------------------------------------
// Lookups (from the snapshot)
// ---------------------------------------------------------------------------------------------

export function getGym(gymId: string): Gym {
  const gym = cache.gyms.find((g) => g.gymId === gymId);
  if (!gym) throw new Error("Gym not found.");
  return gym;
}

export function getUser(userId: string): AppUser | undefined {
  return cache.users.find((u) => u.userId === userId);
}

// ---------------------------------------------------------------------------------------------
// Trainer and member creation (Edge Functions create the sign-in accounts)
// ---------------------------------------------------------------------------------------------

export interface CreateTrainerInput {
  name: string;
  age?: number;
  gender?: AppUser["gender"];
  phone?: string;
  email: string;
  salary: number;
  specialty: string;
  shift: ShiftType;
  maxCapacity?: number;
}

export interface CreatedCredentials {
  publicId: string;
  email: string;
  temporaryPassword: string;
  expiresInHours: number;
  // Filled in by the page from the form, used for the WhatsApp message.
  name?: string;
  phone?: string;
}

export async function createTrainer(_gymId: string, input: CreateTrainerInput): Promise<CreatedCredentials> {
  const { ok, data } = await invokeFn<CreatedCredentials>("create-trainer", { ...input });
  if (!ok || !data.publicId) throw new Error(data.error ?? "We could not create the trainer. Please try again.");
  return data;
}

export interface CreateMemberInput {
  name: string;
  age?: number;
  gender?: AppUser["gender"];
  phone?: string;
  email: string;
  planId: string;
  amountPaid: number;
  paymentMode: Payment["mode"];
  preferredShift: ShiftType;
  goal: string;
}

export async function createMember(
  _gymId: string,
  input: CreateMemberInput,
): Promise<CreatedCredentials & { waitlisted: boolean }> {
  const { ok, data } = await invokeFn<CreatedCredentials & { waitlisted: boolean }>("create-member", { ...input });
  if (!ok || !data.publicId) throw new Error(data.error ?? "We could not create the member. Please try again.");
  return { ...data, waitlisted: !!data.waitlisted };
}

export async function reassignTrainer(_gymId: string, memberId: string): Promise<void> {
  const { error } = await supabase.rpc("assign_trainer", { p_member: memberId });
  check(error);
}

export async function updateTrainer(
  _gymId: string, trainerId: string, patch: Partial<Trainer & { name: string; phone: string }>,
): Promise<void> {
  const trainerPatch: Record<string, unknown> = {};
  if (patch.salary !== undefined) trainerPatch.salary = patch.salary;
  if (patch.specialty !== undefined) trainerPatch.specialty = patch.specialty;
  if (patch.shift !== undefined) trainerPatch.shift = patch.shift;
  if (patch.maxCapacity !== undefined) trainerPatch.max_capacity = patch.maxCapacity;
  if (Object.keys(trainerPatch).length) {
    const { error } = await supabase.from("trainer").update(trainerPatch).eq("user_id", trainerId);
    check(error);
  }
  const userPatch: Record<string, unknown> = {};
  if (patch.name) userPatch.name = patch.name;
  if (patch.phone) userPatch.phone = patch.phone;
  if (Object.keys(userPatch).length) {
    const { error } = await supabase.from("app_user").update(userPatch).eq("user_id", trainerId);
    check(error);
  }
}

// Permanently removes a trainer or member (owner only).
export async function deleteUser(userId: string): Promise<void> {
  const { ok, data } = await invokeFn("delete-user", { userId });
  if (!ok) throw new Error(data.error ?? "We could not remove this person. Please try again.");
}

// Permanently deletes the active gym and all its data (owner only). If the owner has another gym,
// switches to it and returns that session; otherwise signs out and returns null.
export async function deleteGym(): Promise<Session | null> {
  const { ok, data } = await invokeFn<{ nextGymId?: string | null }>("delete-gym", { confirm: "DELETE" });
  if (!ok) throw new Error(data.error ?? "We could not delete the gym. Please try again.");
  if (data.nextGymId) return adoptActiveGym(data.nextGymId);
  logout();
  return null;
}

export async function setUserActive(_gymId: string, userId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("app_user").update({ is_active: isActive }).eq("user_id", userId);
  check(error);
}

export async function recordSalaryPayment(gymId: string, trainerId: string, month: string, amount: number): Promise<void> {
  const { error } = await supabase.from("salary_payment").insert({
    gym_id: gymId, trainer_id: trainerId, month, amount, paid_on: todayStr(),
  });
  if (error?.code === "23505") throw new Error("Salary for this month was already recorded.");
  check(error);
}

// ---------------------------------------------------------------------------------------------
// Subscriptions and payments
// ---------------------------------------------------------------------------------------------

export async function renewSubscription(
  gymId: string, memberId: string, planId: string, amount: number, mode: Payment["mode"],
): Promise<void> {
  const plan = cache.plans.find((p) => p.planId === planId);
  if (!plan) throw new Error("Please choose a valid plan.");

  const latest = cache.subscriptions
    .filter((s) => s.memberId === memberId && s.gymId === gymId)
    .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  const startDate = latest && latest.endDate > todayStr() ? latest.endDate : todayStr();
  const endDate = addDays(startDate, plan.durationDays);

  const { data: sub, error } = await supabase
    .from("subscription")
    .insert({ gym_id: gymId, member_id: memberId, plan_id: planId, start_date: startDate, end_date: endDate, status: "active" })
    .select("sub_id")
    .single();
  check(error);

  const { error: payError } = await supabase.from("payment").insert({
    gym_id: gymId, sub_id: sub!.sub_id, amount, mode, reference: `RENEW-${String(sub!.sub_id).slice(0, 6)}`,
  });
  check(payError);

  await supabase.from("notification").insert({
    gym_id: gymId, user_id: memberId, type: "renewal", message: `Your subscription was renewed until ${endDate}.`,
  });
}

// ---------------------------------------------------------------------------------------------
// Reward points, online payment, announcements, diet and workout plans
// ---------------------------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getPoints(memberId: string): Promise<PointsInfo> {
  const { data, error } = await supabase.rpc("member_points", { p_member: memberId });
  check(error);
  const r = (data ?? {}) as any;
  return {
    visits: r.visits ?? 0, earned: r.earned ?? 0, redeemed: r.redeemed ?? 0, balance: r.balance ?? 0,
    pointValue: Number(r.point_value ?? 0.5), maxDiscountPct: r.max_discount_pct ?? 30,
    pointsPerVisit: r.points_per_visit ?? 10, streakBonus: r.streak_bonus ?? 50,
  };
}

export async function quoteRenewal(memberId: string, planId: string, usePoints: boolean): Promise<RenewalQuote> {
  const { data, error } = await supabase.rpc("quote_renewal", { p_member: memberId, p_plan: planId, p_use_points: usePoints });
  check(error);
  const r = data as any;
  return { price: Number(r.price), discount: Number(r.discount), pointsUsed: r.points_used, payable: Number(r.payable), balance: r.balance };
}

// Owner renews for a member, spending the member's points when asked.
export async function ownerRenewWithPoints(memberId: string, planId: string, usePoints: boolean, mode: Payment["mode"]): Promise<void> {
  const { error } = await supabase.rpc("owner_renew", { p_member: memberId, p_plan: planId, p_use_points: usePoints, p_mode: mode });
  check(error);
}

interface CashfreeOrder { orderId: string; paymentSessionId: string; mode: "sandbox" | "production" }

function loadCashfree(): Promise<void> {
  if ((window as any).Cashfree) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the payment page. Check your internet."));
    document.body.appendChild(s);
  });
}

// Cashfree sends the person back here with ?cf_order=<id> once they have paid (or cancelled).
function paymentReturnUrl(): string {
  return `${window.location.origin}${window.location.pathname}?cf_order={order_id}`;
}

async function openCashfree(order: CashfreeOrder): Promise<void> {
  await loadCashfree();
  const cashfree = (window as any).Cashfree({ mode: order.mode });
  await cashfree.checkout({ paymentSessionId: order.paymentSessionId, redirectTarget: "_self" });
}

export interface NewMemberPayment {
  name: string; age?: number; gender?: string; phone?: string; email: string; planId: string;
  amountPaid: number; preferredShift?: string; goal?: string;
}

// Owner: opens Cashfree to take the joining fee. The member is created after the payment is confirmed.
export async function startMemberPayment(member: NewMemberPayment): Promise<void> {
  const { ok, data } = await invokeFn<CashfreeOrder>("cashfree-order", { kind: "member", member, returnUrl: paymentReturnUrl() });
  if (!ok || !data.paymentSessionId) throw new Error(data.error ?? "The payment could not be started.");
  await openCashfree(data);
}

// Member: opens Cashfree to pay for their own renewal.
export async function startRenewalPayment(planId: string, usePoints: boolean): Promise<void> {
  const { ok, data } = await invokeFn<CashfreeOrder>("cashfree-order", { kind: "renewal", planId, usePoints, returnUrl: paymentReturnUrl() });
  if (!ok || !data.paymentSessionId) throw new Error(data.error ?? "The payment could not be started.");
  await openCashfree(data);
}

export interface PaymentResult {
  status: "paid" | "done" | "unpaid" | "failed" | "processing";
  kind: "member" | "renewal";
  credentials?: { publicId: string; email: string; temporaryPassword: string; expiresInHours: number; waitlisted: boolean };
  name?: string;
  phone?: string;
  endDate?: string;
  alreadyDone?: boolean;
}

export async function verifyOnlinePayment(orderId: string): Promise<PaymentResult> {
  const { ok, data } = await invokeFn<PaymentResult>("cashfree-verify", { orderId });
  if (!ok) throw new Error(data.error ?? "We could not confirm the payment.");
  return data;
}

// Owner sends a test alert. Returns how many devices the person has registered.
export async function sendTestNotification(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc("send_test_notification", { p_user: userId });
  check(error);
  return Number(data ?? 0);
}

export async function sendAnnouncement(title: string, message: string, audience: "all" | "members" | "trainers"): Promise<number> {
  const { data, error } = await supabase.rpc("send_announcement", { p_title: title, p_message: message, p_audience: audience });
  check(error);
  return Number(data ?? 0);
}

export async function addMemberPlan(
  session: Session, input: { memberId: string; kind: "diet" | "workout"; title: string; content: string },
): Promise<void> {
  const { error } = await supabase.from("member_plan").insert({
    gym_id: session.gymId, member_id: input.memberId, created_by: session.userId,
    kind: input.kind, title: input.title.trim(), content: input.content.trim(),
  });
  check(error);
}

export async function deleteMemberPlan(planId: string): Promise<void> {
  const { error } = await supabase.from("member_plan").delete().eq("id", planId);
  check(error);
}

// Ticks or unticks a plan for a day (the member's own "done" mark).
export async function setPlanDone(session: Session, planId: string, date: string, done: boolean): Promise<void> {
  if (done) {
    const { error } = await supabase.from("member_plan_log").upsert(
      { gym_id: session.gymId, plan_id: planId, member_id: session.userId, log_date: date },
      { onConflict: "plan_id,log_date" },
    );
    check(error);
  } else {
    const { error } = await supabase.from("member_plan_log").delete().eq("plan_id", planId).eq("log_date", date);
    check(error);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Streak and badges come straight from the attendance rows the member can already see.
export interface StreakInfo { current: number; longest: number; badges: { id: string; label: string; earned: boolean; hint: string }[] }

export function computeStreak(db: Db, memberId: string): StreakInfo {
  const days = Array.from(new Set(db.attendance.filter((a) => a.memberId === memberId && a.checkIn).map((a) => a.attendanceDate))).sort();
  const set = new Set(days);
  let longest = 0, run = 0, prev = "";
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  // The streak is still alive if the member came today or yesterday.
  const today = todayStr();
  let cursor = set.has(today) ? today : set.has(addDays(today, -1)) ? addDays(today, -1) : "";
  let current = 0;
  while (cursor && set.has(cursor)) { current++; cursor = addDays(cursor, -1); }
  const total = days.length;
  const badges = [
    { id: "first", label: "First Step", earned: total >= 1, hint: "Attend your first day" },
    { id: "streak7", label: "7-Day Streak", earned: longest >= 7, hint: "Come 7 days in a row" },
    { id: "streak30", label: "30-Day Streak", earned: longest >= 30, hint: "Come 30 days in a row" },
    { id: "visits25", label: "25 Visits", earned: total >= 25, hint: "Attend 25 days" },
    { id: "visits100", label: "Century Club", earned: total >= 100, hint: "Attend 100 days" },
  ];
  return { current, longest, badges };
}

// ---------------------------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------------------------

function attendedDaysInLast30(db: Db, memberId: string): number {
  const cutoff = addDays(todayStr(), -30);
  return db.attendance.filter((a) => a.memberId === memberId && a.attendanceDate >= cutoff && a.checkIn).length;
}

export function ratingEligibility(_gymId: string, memberId: string): { eligible: boolean; attendedDays: number } {
  const attendedDays = attendedDaysInLast30(cache, memberId);
  return { eligible: attendedDays >= 8, attendedDays };
}

export async function addRating(
  gymId: string, memberId: string, input: { trainerId?: string; equipmentId?: string; score: number; comment: string },
): Promise<void> {
  if (attendedDaysInLast30(cache, memberId) < 8) {
    throw new Error("Rating locked: attend at least 8 days in the last 30 days first.");
  }
  const { error } = await supabase.from("rating").insert({
    gym_id: gymId, member_id: memberId, trainer_id: input.trainerId ?? null, equipment_id: input.equipmentId ?? null,
    score: input.score, comment: input.comment, period_start: todayStr().slice(0, 7) + "-01",
  });
  check(error);
}

// ---------------------------------------------------------------------------------------------
// Change requests
// ---------------------------------------------------------------------------------------------

export async function submitChangeRequest(
  gymId: string, memberId: string, reason: string, submittedBy: UserRole = "member",
): Promise<void> {
  const member = cache.members.find((m) => m.userId === memberId);
  const { error } = await supabase.from("change_request").insert({
    gym_id: gymId, member_id: memberId, from_trainer: member?.assignedTrainerId ?? null,
    reason, status: "pending", submitted_by: submittedBy,
  });
  check(error);
}

export async function decideChangeRequest(
  gymId: string, reqId: string, decision: "approved" | "rejected", deciderId: string,
): Promise<void> {
  const request = cache.changeRequests.find((r) => r.reqId === reqId && r.gymId === gymId);
  if (!request) throw new Error("Request not found.");

  const { error } = await supabase
    .from("change_request")
    .update({ status: decision, decided_by: deciderId })
    .eq("req_id", reqId);
  check(error);

  if (decision === "approved" && cache.members.some((m) => m.userId === request.memberId)) {
    const { error: clearError } = await supabase.from("member").update({ assigned_trainer_id: null }).eq("user_id", request.memberId);
    check(clearError);
    const { error: assignError } = await supabase.rpc("assign_trainer", { p_member: request.memberId });
    check(assignError);
    const { data: member } = await supabase.from("member").select("assigned_trainer_id").eq("user_id", request.memberId).maybeSingle();
    await supabase.from("change_request").update({ to_trainer: member?.assigned_trainer_id ?? null }).eq("req_id", reqId);
  }
}

export async function submitNewMemberForApproval(
  gymId: string, trainerId: string, name: string, reason: string,
): Promise<void> {
  const { error } = await supabase.from("change_request").insert({
    gym_id: gymId, member_id: trainerId, from_trainer: trainerId,
    reason: `New member suggestion: ${name}. ${reason}`, status: "pending", submitted_by: "trainer",
  });
  check(error);
}

// ---------------------------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------------------------

export async function upsertEquipment(gymId: string, input: Partial<Equipment> & { name: string }): Promise<void> {
  if (input.equipmentId) {
    const patch: Record<string, unknown> = { name: input.name };
    if (input.conditionScore !== undefined) patch.condition_score = input.conditionScore;
    if (input.lastServiced !== undefined) patch.last_serviced = input.lastServiced;
    const { error } = await supabase.from("equipment").update(patch).eq("equipment_id", input.equipmentId);
    check(error);
  } else {
    const { error } = await supabase.from("equipment").insert({
      gym_id: gymId, name: input.name, condition_score: input.conditionScore ?? 5,
      last_serviced: input.lastServiced ?? todayStr(),
    });
    check(error);
  }
}

export async function removeEquipment(_gymId: string, equipmentId: string): Promise<void> {
  const { error } = await supabase.from("equipment").delete().eq("equipment_id", equipmentId);
  if (error?.code === "23503") throw new Error("This equipment has ratings, so it cannot be removed.");
  check(error);
}

// ---------------------------------------------------------------------------------------------
// Attendance, QR and GPS
// ---------------------------------------------------------------------------------------------

export interface QrPayloads {
  date: string;
  checkIn: string;
  checkOut: string;
}

// Owner only. The signing secret stays on the server, so only the Edge Function can mint codes.
export async function getAttendanceQr(_gymId: string, _minuteBucket?: number): Promise<QrPayloads> {
  const { ok, data } = await invokeFn<QrPayloads>("attendance-qr", {});
  if (!ok || !data.checkIn) throw new Error(data.error ?? "We could not generate the QR codes right now.");
  return { date: data.date, checkIn: data.checkIn, checkOut: data.checkOut };
}

export interface ScanResult {
  ok: boolean;
  message: string;
  status?: "pending" | "approved" | "rejected" | "expired";
  requestId?: string;
}

interface ScanReply {
  ok?: boolean;
  message?: string;
  status?: ScanResult["status"];
  requestId?: string;
}

function toScanResult(ok: boolean, data: ScanReply & { error?: string }): ScanResult {
  return {
    ok: ok && data.ok !== false,
    message: data.message ?? data.error ?? "We could not record your attendance. Please try again.",
    status: data.status,
    requestId: data.requestId,
  };
}

// Scans a QR code. The server checks the signature, the gym, the date and the GPS reading.
// Check-in creates an approval request, check-out is recorded straight away.
export async function attendanceScan(
  _session: Session, token: string, lat: number | null, lng: number | null, accuracy: number | null,
): Promise<ScanResult> {
  const { ok, data } = await invokeFn<ScanReply>("attendance-scan", {
    token, latitude: lat, longitude: lng, accuracy,
  });
  return toScanResult(ok, data);
}

// Asks for attendance approval. Used for the GPS-only flow (no QR scan).
export async function createAttendanceRequest(
  _session: Session,
  lat: number | null,
  lng: number | null,
  accuracy: number | null,
  _method: "qr_gps" | "gps_only" = "gps_only",
): Promise<ScanResult> {
  const { ok, data } = await invokeFn<ScanReply>("attendance-scan", {
    gpsOnly: true, latitude: lat, longitude: lng, accuracy,
  });
  return toScanResult(ok, data);
}

// Attendance requests visible to the current user (role-filtered by the database as well).
export function getAttendanceRequests(session: Session): AttendanceRequest[] {
  const today = todayStr();
  return cache.attendanceRequests.filter((r) => {
    if (r.gymId !== session.gymId) return false;
    if (session.role === "owner") return true;
    if (session.role === "trainer") return r.trainerId === session.userId;
    return r.memberId === session.userId && r.requestedAt.slice(0, 10) === today;
  });
}

export function getMemberTodayRequest(session: Session): AttendanceRequest | null {
  const today = todayStr();
  const mine = cache.attendanceRequests
    .filter((r) => r.gymId === session.gymId && r.memberId === session.userId && r.requestedAt.slice(0, 10) === today)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  return mine[0] ?? null;
}

// Approve or reject a request. The SQL function enforces who may decide and that the first decision wins.
export async function decideAttendanceRequest(
  session: Session,
  requestId: string,
  decision: "approved" | "rejected",
  reason?: string,
): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await supabase.rpc("decide_attendance_request", {
    p_request_id: requestId, p_decision: decision, p_decider: session.userId, p_reason: reason ?? null,
  });
  if (error) return { ok: false, message: error.message };
  const reply = (data ?? {}) as { ok?: boolean; error?: string };
  if (!reply.ok) return { ok: false, message: reply.error ?? "We could not save that decision." };
  return { ok: true, message: decision === "approved" ? "Approved" : "Rejected" };
}

// Approves every pending request from today that the current user is allowed to decide.
export async function approveAllAttendanceRequests(session: Session): Promise<{ approved: number }> {
  const today = todayStr();
  const pending = cache.attendanceRequests.filter((r) => {
    if (r.gymId !== session.gymId || r.status !== "pending") return false;
    if (r.requestedAt.slice(0, 10) !== today) return false;
    if (session.role === "trainer") return r.trainerId === session.userId;
    return session.role === "owner";
  });
  let approved = 0;
  for (const req of pending) {
    const result = await decideAttendanceRequest(session, req.requestId, "approved");
    if (result.ok) approved += 1;
  }
  return { approved };
}

export async function gpsOnlyRequest(session: Session, lat: number, lng: number, accuracy: number): Promise<ScanResult> {
  return createAttendanceRequest(session, lat, lng, accuracy, "gps_only");
}

export async function manualAttendanceCorrection(
  gymId: string, editorId: string, attId: string, patch: { checkIn?: string | null; checkOut?: string | null },
): Promise<void> {
  const row = cache.attendance.find((a) => a.attId === attId && a.gymId === gymId);
  if (!row) throw new Error("Attendance record not found.");

  const update: Record<string, unknown> = { edited_by: editorId };
  const nextIn = patch.checkIn !== undefined ? patch.checkIn : row.checkIn;
  if (patch.checkIn !== undefined) {
    update.check_in = patch.checkIn;
    update.in_method = "manual";
  }
  if (patch.checkOut !== undefined) {
    if (patch.checkOut && nextIn && new Date(patch.checkOut) <= new Date(nextIn)) {
      throw new Error("Check-out time must be after check-in time.");
    }
    update.check_out = patch.checkOut;
    update.out_method = "manual";
  }
  // The database trigger writes the audit row (old and new values) for us.
  const { error } = await supabase.from("attendance").update(update).eq("att_id", attId);
  check(error);
}

// Sets attendance for one member on one day (owner, or the member's trainer).
// Creates the record if there is none, otherwise changes it.
export async function setManualAttendance(
  gymId: string, memberId: string, editorId: string, date: string,
  checkIn: string | null, checkOut: string | null,
): Promise<void> {
  if (!checkIn) throw new Error("Choose a check-in time.");
  if (date > todayStr()) throw new Error("You cannot mark attendance for a future date.");
  if (checkOut && new Date(checkOut) <= new Date(checkIn)) {
    throw new Error("Check-out time must be after check-in time.");
  }
  const existing = cache.attendance.find((a) => a.memberId === memberId && a.attendanceDate === date);
  if (existing) {
    const { error } = await supabase.from("attendance").update({
      check_in: checkIn, check_out: checkOut, in_method: "manual",
      out_method: checkOut ? "manual" : null, edited_by: editorId,
    }).eq("att_id", existing.attId);
    check(error);
    return;
  }
  const { error } = await supabase.from("attendance").insert({
    gym_id: gymId, member_id: memberId, attendance_date: date, check_in: checkIn, check_out: checkOut,
    in_method: "manual", out_method: checkOut ? "manual" : null, edited_by: editorId,
  });
  if (error?.code === "23505") throw new Error("Attendance already exists for this date. Refresh and try again.");
  check(error);
}

export async function manualCheckIn(gymId: string, memberId: string, editorId: string): Promise<void> {
  const today = todayStr();
  if (cache.attendance.some((a) => a.memberId === memberId && a.attendanceDate === today)) {
    throw new Error("This member already has attendance recorded today.");
  }
  const { error } = await supabase.from("attendance").insert({
    gym_id: gymId, member_id: memberId, attendance_date: today, check_in: nowIso(),
    in_method: "manual", edited_by: editorId,
  });
  if (error?.code === "23505") throw new Error("This member already has attendance recorded today.");
  check(error);
}

// ---------------------------------------------------------------------------------------------
// Trainer attendance (the trainer's own days, approved by the owner)
// ---------------------------------------------------------------------------------------------

interface RpcReply {
  ok?: boolean;
  error?: string;
}

function rpcResult(data: unknown, error: PgError | null, success: string): { ok: boolean; message: string } {
  if (error) return { ok: false, message: error.message };
  const reply = (data ?? {}) as RpcReply;
  return reply.ok ? { ok: true, message: success } : { ok: false, message: reply.error ?? "Something went wrong." };
}

export function getMyTrainerAttendance(session: Session): TrainerAttendance[] {
  return cache.trainerAttendance
    .filter((a) => a.trainerId === session.userId)
    .sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate));
}

// The trainer asks to be marked present today. The owner gets a notification to approve it.
export async function trainerCheckIn(
  lat: number | null, lng: number | null, accuracy: number | null,
): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await supabase.rpc("trainer_check_in", { p_lat: lat, p_lng: lng, p_accuracy: accuracy });
  return rpcResult(data, error, "Sent to the owner for approval");
}

export async function trainerCheckOut(): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await supabase.rpc("trainer_check_out");
  return rpcResult(data, error, "Checked out");
}

// Owner approves or rejects a trainer's attendance.
export async function decideTrainerAttendance(
  id: string, decision: "approved" | "rejected", reason?: string,
): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await supabase.rpc("decide_trainer_attendance", {
    p_id: id, p_decision: decision, p_reason: reason ?? null,
  });
  return rpcResult(data, error, decision === "approved" ? "Approved" : "Rejected");
}

// Owner marks or corrects a trainer's attendance for a day (counts as approved).
export async function setTrainerManualAttendance(
  gymId: string, trainerId: string, ownerId: string, date: string,
  checkIn: string | null, checkOut: string | null,
): Promise<void> {
  if (!checkIn) throw new Error("Choose a check-in time.");
  if (date > todayStr()) throw new Error("You cannot mark attendance for a future date.");
  if (checkOut && new Date(checkOut) <= new Date(checkIn)) {
    throw new Error("Check-out time must be after check-in time.");
  }
  const existing = cache.trainerAttendance.find((a) => a.trainerId === trainerId && a.attendanceDate === date);
  const row = {
    check_in: checkIn, check_out: checkOut, status: "approved", method: "manual",
    decided_by: ownerId, decided_at: nowIso(), reject_reason: null,
  };
  if (existing) {
    const { error } = await supabase.from("trainer_attendance").update(row).eq("id", existing.id);
    check(error);
    return;
  }
  const { error } = await supabase.from("trainer_attendance").insert({
    gym_id: gymId, trainer_id: trainerId, attendance_date: date, ...row,
  });
  if (error?.code === "23505") throw new Error("Attendance already exists for this date. Refresh and try again.");
  check(error);
}

// ---------------------------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------------------------

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from("notification").update({ is_read: true }).eq("id", id);
  check(error);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase.from("notification").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
  check(error);
}

// ---------------------------------------------------------------------------------------------

export interface MemberFeatures {
  memberId: string;
  visits7d: number;
  visits30d: number;
  visitsPrev30d: number;
  daysSinceLastVisit: number | null;
  daysToExpiry: number | null;
  avgRatingGiven: number | null;
  tenureDays: number;
}

export function computeMemberFeatures(db: Db, memberId: string): MemberFeatures {
  const member = db.members.find((m) => m.userId === memberId)!;
  const today = todayStr();
  const records = db.attendance.filter((a) => a.memberId === memberId && a.checkIn);
  const visits7d = records.filter((a) => a.attendanceDate >= addDays(today, -7)).length;
  const visits30d = records.filter((a) => a.attendanceDate >= addDays(today, -30)).length;
  const visitsPrev30d = records.filter(
    (a) => a.attendanceDate >= addDays(today, -60) && a.attendanceDate < addDays(today, -30),
  ).length;
  const lastVisit = records.map((a) => a.attendanceDate).sort().pop();
  const daysSinceLastVisit = lastVisit ? daysBetween(lastVisit, today) : null;
  const activeSub = db.subscriptions
    .filter((s) => s.memberId === memberId && s.status === "active")
    .sort((a, b) => a.endDate.localeCompare(b.endDate))[0];
  const daysToExpiry = activeSub ? daysBetween(today, activeSub.endDate) : null;
  const given = db.ratings.filter((r) => r.memberId === memberId);
  const avgRatingGiven = given.length ? given.reduce((s, r) => s + r.score, 0) / given.length : null;
  const tenureDays = daysBetween(member.joinedOn, today);
  return { memberId, visits7d, visits30d, visitsPrev30d, daysSinceLastVisit, daysToExpiry, avgRatingGiven, tenureDays };
}

function reasonsFor(f: MemberFeatures): string[] {
  const reasons: string[] = [];
  if (f.daysSinceLastVisit != null && f.daysSinceLastVisit >= 10) {
    reasons.push(`No visit in ${f.daysSinceLastVisit} days`);
  }
  if (f.visitsPrev30d > 0 && f.visits30d < f.visitsPrev30d) {
    const dropPct = Math.round((1 - f.visits30d / f.visitsPrev30d) * 100);
    if (dropPct >= 30) reasons.push(`Attendance down ${dropPct} percent`);
  }
  if (f.daysToExpiry != null && f.daysToExpiry <= 7) {
    reasons.push(`Subscription ends in ${Math.max(f.daysToExpiry, 0)} days`);
  }
  if (f.avgRatingGiven != null && f.avgRatingGiven < 3) {
    reasons.push("Low satisfaction rating given");
  }
  if (!reasons.length) reasons.push("Overall engagement trending down");
  return reasons.slice(0, 3);
}

function riskScore(f: MemberFeatures): number {
  let score = 0.08;
  if (f.daysSinceLastVisit != null) score += Math.min(f.daysSinceLastVisit / 30, 1) * 0.4;
  if (f.visitsPrev30d > 0) {
    const drop = Math.max(0, 1 - f.visits30d / f.visitsPrev30d);
    score += drop * 0.3;
  } else if (f.visits30d === 0) {
    score += 0.2;
  }
  if (f.daysToExpiry != null && f.daysToExpiry <= 7) score += 0.15;
  if (f.avgRatingGiven != null && f.avgRatingGiven < 3) score += 0.1;
  return Math.max(0, Math.min(1, score));
}


// Churn alerts are scored in the browser from the same signals the analytics job uses
// (visits, days since last visit, expiry, ratings). They are not stored in the database.
function recomputeChurnAlertsInto(db: Db, gymId: string) {
  const today = todayStr();
  db.churnAlerts = [];
  for (const m of db.members.filter((x) => x.gymId === gymId)) {
    const features = computeMemberFeatures(db, m.userId);
    const score = riskScore(features);
    if (score >= 0.6) {
      db.churnAlerts.push({
        alertId: uid(), gymId, memberId: m.userId, riskScore: Number(score.toFixed(3)),
        reasons: reasonsFor(features), createdOn: today,
      });
    }
  }
}

export function recomputeChurnAlerts(gymId: string): ChurnAlert[] {
  recomputeChurnAlertsInto(cache, gymId);
  return cache.churnAlerts.filter((a) => a.gymId === gymId);
}

// ---------------------------------------------------------------------------------------------
// Gym settings
// ---------------------------------------------------------------------------------------------

export async function updateGymSettings(gymId: string, patch: Partial<Gym>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.address !== undefined) update.address = patch.address;
  if (patch.latitude !== undefined) update.latitude = patch.latitude;
  if (patch.longitude !== undefined) update.longitude = patch.longitude;
  if (patch.radiusM !== undefined) update.radius_m = patch.radiusM;
  if (patch.closingTime !== undefined) update.closing_time = patch.closingTime;
  if (patch.requireCheckoutApproval !== undefined) update.require_checkout_approval = patch.requireCheckoutApproval;
  if (patch.pointsPerVisit !== undefined) update.points_per_visit = patch.pointsPerVisit;
  if (patch.pointValue !== undefined) update.point_value = patch.pointValue;
  if (patch.streakBonus !== undefined) update.streak_bonus = patch.streakBonus;
  if (patch.maxDiscountPct !== undefined) update.max_discount_pct = patch.maxDiscountPct;
  if (!Object.keys(update).length) return;
  const { error } = await supabase.from("gym").update(update).eq("gym_id", gymId);
  check(error);
}

export async function upsertPlan(
  gymId: string, input: Partial<Plan> & { name: string; durationDays: number; price: number },
): Promise<void> {
  const row = { name: input.name, duration_days: input.durationDays, price: input.price };
  if (input.planId) {
    const { error } = await supabase.from("plan").update(row).eq("plan_id", input.planId);
    check(error);
  } else {
    const { error } = await supabase.from("plan").insert({ gym_id: gymId, ...row });
    check(error);
  }
}

export async function addBodyMetric(
  gymId: string, memberId: string, weightKg: number | null, waistCm: number | null,
): Promise<void> {
  const { error } = await supabase.from("body_metric").insert({
    gym_id: gymId, member_id: memberId, recorded_on: todayStr(), weight_kg: weightKg, waist_cm: waistCm,
  });
  check(error);
}

// ---------------------------------------------------------------------------------------------
// Export / delete for members (data portability)
// ---------------------------------------------------------------------------------------------

export function exportMemberData(_gymId: string, memberId: string) {
  const db = cache;
  const { password: _password, ...profile } = db.users.find((u) => u.userId === memberId) ?? ({} as AppUser);
  return {
    profile,
    member: db.members.find((m) => m.userId === memberId),
    subscriptions: db.subscriptions.filter((s) => s.memberId === memberId),
    payments: db.payments.filter((p) => db.subscriptions.some((s) => s.subId === p.subId && s.memberId === memberId)),
    attendance: db.attendance.filter((a) => a.memberId === memberId),
    bodyMetrics: db.bodyMetrics.filter((b) => b.memberId === memberId),
    ratings: db.ratings.filter((r) => r.memberId === memberId),
  };
}

// Members cannot see the owner's row, so a SQL function (migration 0010) sends the notification.
export async function requestAccountDeletion(_gymId: string, _memberId: string): Promise<void> {
  const { error } = await supabase.rpc("request_account_deletion");
  check(error);
}

export { loadDb, saveDb, uid, nowIso, todayStr, addDays, daysBetween };

// The old demo reset only made sense for browser storage. Now it just signs out and clears the snapshot.
export function resetDemoData() {
  logout();
}
