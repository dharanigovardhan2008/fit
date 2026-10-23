import { createClient } from "jsr:@supabase/supabase-js@2";

// Service role client: full access, used only inside Edge Functions, never shipped to the browser.
export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export function anonClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export function randomPassword(length = 14): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export async function hmacSign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface Caller {
  user_id: string;
  auth_id: string;
  gym_id: string;
  role: string;
  is_active: boolean;
  name: string;
  email: string;
  phone: string | null;
  age: number | null;
  gender: string | null;
}

// Identifies the signed-in caller from their token and reads their role from the app_user table
// (the source of truth). An owner can have several gyms, so the row used is the one for the gym
// stored in their token (app_metadata.gym_id, changed by the switch-gym function).
export async function getCaller(req: Request) {
  const admin = adminClient();
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data } = await admin.auth.getUser(token);
  if (!data?.user) return { admin, caller: null as Caller | null };
  let query = admin.from("app_user").select("*").eq("auth_id", data.user.id).eq("is_active", true);
  const gymId = data.user.app_metadata?.gym_id;
  if (gymId) query = query.eq("gym_id", gymId);
  const { data: row } = await query.limit(1).maybeSingle();
  return { admin, caller: (row ?? null) as Caller | null };
}

// Points a sign-in account at one of its gyms. The next token refresh carries the new gym.
export async function setActiveGym(
  admin: ReturnType<typeof adminClient>, authId: string, gymId: string, role: string,
) {
  await admin.auth.admin.updateUserById(authId, { app_metadata: { gym_id: gymId, role } });
}

export function generateGymCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "0123456789";
  const pick = (set: string, n: number) =>
    Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => set[b % set.length]).join("");
  return pick(letters, 3) + pick(digits, 3);
}

// Phone numbers are stored as digits only, so "+91 94934 46982" and "9493446982" match.
export function normalizePhone(phone: unknown): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length ? digits : null;
}

export async function phoneTaken(
  admin: ReturnType<typeof adminClient>, phone: string, gymId: string,
): Promise<boolean> {
  const last10 = phone.slice(-10);
  const { data } = await admin
    .from("app_user").select("user_id").eq("gym_id", gymId).like("phone", `%${last10}`).limit(1);
  return !!data?.length;
}
