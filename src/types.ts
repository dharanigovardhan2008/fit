export type UserRole = "owner" | "trainer" | "member";
export type SubStatus = "active" | "expired" | "cancelled";
export type RequestStatus = "pending" | "approved" | "rejected" | "expired";
export type AttendMethod = "qr_gps" | "manual" | "geofence" | "auto_close" | "gps_only";
export type ShiftType = "morning" | "evening" | "full";
export type GenderType = "male" | "female" | "other";
export type PaymentMode = "cash" | "upi" | "card";

export interface Gym {
  gymId: string;
  code: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  radiusM: number;
  closingTime: string;
  requireCheckoutApproval: boolean;
  createdAt: string;
}

export interface AppUser {
  userId: string;
  gymId: string;
  publicId: string;
  role: UserRole;
  name: string;
  age: number | null;
  gender: GenderType | null;
  phone: string | null;
  email: string;
  password: string;
  mustChangePassword: boolean;
  tempPasswordExpiry: string | null;
  failedAttempts: number;
  lockedUntil: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Trainer {
  userId: string;
  gymId: string;
  salary: number;
  specialty: string;
  shift: ShiftType;
  maxCapacity: number;
  joinedOn: string;
}

export interface Member {
  userId: string;
  gymId: string;
  assignedTrainerId: string | null;
  goal: string;
  preferredShift: ShiftType;
  joinedOn: string;
  waitlisted: boolean;
}

export interface Plan {
  planId: string;
  gymId: string;
  name: string;
  durationDays: number;
  price: number;
}

export interface Subscription {
  subId: string;
  gymId: string;
  memberId: string;
  planId: string;
  startDate: string;
  endDate: string;
  status: SubStatus;
}

export interface Payment {
  paymentId: string;
  gymId: string;
  subId: string;
  amount: number;
  mode: PaymentMode;
  paidAt: string;
  reference: string;
}

export interface Attendance {
  attId: string;
  gymId: string;
  memberId: string;
  attendanceDate: string;
  checkIn: string | null;
  checkOut: string | null;
  inMethod: AttendMethod | null;
  outMethod: AttendMethod | null;
  distanceM: number | null;
  editedBy: string | null;
}

export interface Equipment {
  equipmentId: string;
  gymId: string;
  name: string;
  conditionScore: number;
  lastServiced: string | null;
}

export interface Rating {
  ratingId: string;
  gymId: string;
  memberId: string;
  trainerId: string | null;
  equipmentId: string | null;
  score: number;
  comment: string;
  periodStart: string;
  createdAt: string;
}

export interface ChangeRequest {
  reqId: string;
  gymId: string;
  memberId: string;
  fromTrainer: string | null;
  toTrainer: string | null;
  reason: string;
  status: RequestStatus;
  decidedBy: string | null;
  createdAt: string;
  submittedBy: UserRole;
}

export interface SalaryPayment {
  id: string;
  gymId: string;
  trainerId: string;
  month: string;
  amount: number;
  paidOn: string;
}

export interface BodyMetric {
  id: string;
  gymId: string;
  memberId: string;
  recordedOn: string;
  weightKg: number | null;
  waistCm: number | null;
}

export interface Notification {
  id: string;
  gymId: string;
  userId: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface ChurnAlert {
  alertId: string;
  gymId: string;
  memberId: string;
  riskScore: number;
  reasons: string[];
  createdOn: string;
}

export interface AttendanceAudit {
  id: string;
  gymId: string;
  attId: string;
  changedBy: string;
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  changedAt: string;
}

export interface AttendanceRequest {
  requestId: string;
  gymId: string;
  memberId: string;
  trainerId: string | null;
  method: AttendMethod;
  requestedAt: string;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  distanceM: number | null;
  status: RequestStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  rejectReason: string | null;
  attId: string | null;
}

export interface Session {
  authId: string;
  gymId: string;
  userId: string;
  publicId: string;
  role: UserRole;
  name: string;
  mustChangePassword: boolean;
}

export interface TrainerAttendance {
  id: string;
  gymId: string;
  trainerId: string;
  attendanceDate: string;
  checkIn: string | null;
  checkOut: string | null;
  status: RequestStatus;
  method: "self" | "manual";
  latitude: number | null;
  longitude: number | null;
  distanceM: number | null;
  decidedBy: string | null;
  decidedAt: string | null;
  rejectReason: string | null;
}

export interface GymOption {
  gymId: string;
  name: string;
}
