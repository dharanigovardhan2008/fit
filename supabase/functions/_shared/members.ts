// Creates a member: sign-in account, profile, first subscription, payment, trainer and alerts.
// Used by create-member (cash) and cashfree-verify (after an online payment).
import { normalizePhone, phoneTaken, randomPassword, adminClient } from "./client.ts";

export interface NewMemberInput {
  name: string;
  age?: number | null;
  gender?: string | null;
  phone?: string | null;
  email: string;
  planId: string;
  amountPaid?: number | null;
  paymentMode?: string | null;
  preferredShift?: string | null;
  goal?: string | null;
  reference?: string | null;
}

export type CreateMemberResult =
  | { ok: true; data: { publicId: string; email: string; temporaryPassword: string; expiresInHours: number; waitlisted: boolean } }
  | { ok: false; status: number; error: string };

export async function createMemberCore(
  admin: ReturnType<typeof adminClient>, gymId: string, input: NewMemberInput,
): Promise<CreateMemberResult> {
  const name = String(input.name ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const phone = normalizePhone(input.phone);
  if (!name || !email || !input.planId) return { ok: false, status: 400, error: "Name, email and plan are required." };

  if (phone && (await phoneTaken(admin, phone, gymId))) {
    return { ok: false, status: 409, error: "A user with this phone number already exists." };
  }

  const tempPassword = randomPassword(14);
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email, password: tempPassword, email_confirm: true, app_metadata: { gym_id: gymId, role: "member" },
  });
  if (authError) return { ok: false, status: 409, error: "A user with this email already exists." };

  const { data: publicId } = await admin.rpc("next_public_id", { p_gym: gymId, p_role: "member" });

  const { data: appUser, error: userError } = await admin
    .from("app_user")
    .insert({
      auth_id: authUser.user.id, gym_id: gymId, public_id: publicId, role: "member", name,
      age: input.age ?? null, gender: input.gender ?? null, phone, email,
      must_change_password: true, temp_password_expiry: new Date(Date.now() + 48 * 3600_000).toISOString(),
    })
    .select()
    .single();
  if (userError) throw userError;

  await admin.from("member").insert({
    user_id: appUser.user_id, gym_id: gymId, preferred_shift: input.preferredShift ?? "full", goal: input.goal ?? null,
  });

  const { data: plan } = await admin.from("plan").select("*").eq("plan_id", input.planId).single();
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + plan.duration_days * 86400_000);

  const { data: subscription } = await admin
    .from("subscription")
    .insert({
      gym_id: gymId, member_id: appUser.user_id, plan_id: input.planId,
      start_date: startDate.toISOString().slice(0, 10), end_date: endDate.toISOString().slice(0, 10), status: "active",
    })
    .select()
    .single();

  await admin.from("payment").insert({
    gym_id: gymId, sub_id: subscription.sub_id, amount: input.amountPaid ?? plan.price,
    mode: input.paymentMode ?? "cash", reference: input.reference ?? `${publicId}-JOIN`,
  });

  await admin.rpc("assign_trainer", { p_member: appUser.user_id });

  const { data: refreshedMember } = await admin
    .from("member").select("assigned_trainer_id, waitlisted").eq("user_id", appUser.user_id).single();

  const notifications = [
    { gym_id: gymId, user_id: appUser.user_id, type: "welcome", message: "Welcome to the gym. Your membership is active." },
  ];
  const { data: owner } = await admin.from("app_user").select("user_id").eq("gym_id", gymId).eq("role", "owner").limit(1).maybeSingle();
  if (owner) {
    notifications.push({
      gym_id: gymId, user_id: owner.user_id, type: "new_member",
      message: refreshedMember?.waitlisted
        ? `${name} joined and is waitlisted (no trainer capacity available).`
        : `${name} joined and was assigned a trainer.`,
    });
  }
  if (refreshedMember?.assigned_trainer_id) {
    notifications.push({
      gym_id: gymId, user_id: refreshedMember.assigned_trainer_id, type: "new_member",
      message: `${name} was assigned to you as a new member.`,
    });
  }
  await admin.from("notification").insert(notifications);

  return {
    ok: true,
    data: { publicId, email, temporaryPassword: tempPassword, expiresInHours: 48, waitlisted: refreshedMember?.waitlisted ?? false },
  };
}
