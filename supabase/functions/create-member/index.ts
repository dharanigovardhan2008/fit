// Edge Function: create-member (owner only, trainers may submit for approval via change_request)
// Creates the Auth user, app_user (M.....), member row, a starting subscription and payment
// record, then runs assign_trainer and writes notifications for member, trainer and owner.
import { getCaller, normalizePhone, phoneTaken, randomPassword } from "../_shared/client.ts";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { admin, caller } = await getCaller(req);
    if (!caller) return jsonResponse({ error: "Please sign in again." }, 401);
    const gymId = caller.gym_id;
    if (caller.role !== "owner") {
      return jsonResponse({ error: "You do not have permission to do this." }, 403);
    }

    const body = await req.json();
    const { name, age, gender, phone: rawPhone, email: rawEmail, planId, amountPaid, paymentMode, preferredShift, goal } = body;
    const email = String(rawEmail ?? "").trim().toLowerCase();
    const phone = normalizePhone(rawPhone);
    if (!name || !email || !planId) {
      return jsonResponse({ error: "Name, email and plan are required." }, 400);
    }

    if (phone && (await phoneTaken(admin, phone, gymId))) {
      return jsonResponse({ error: "A user with this phone number already exists." }, 409);
    }

    const tempPassword = randomPassword(14);

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      app_metadata: { gym_id: gymId, role: "member" },
    });
    if (authError) {
      return jsonResponse({ error: "A user with this email already exists." }, 409);
    }

    const { data: publicId } = await admin.rpc("next_public_id", { p_gym: gymId, p_role: "member" });

    const { data: appUser, error: userError } = await admin
      .from("app_user")
      .insert({
        auth_id: authUser.user.id,
        gym_id: gymId,
        public_id: publicId,
        role: "member",
        name,
        age: age ?? null,
        gender: gender ?? null,
        phone,
        email,
        must_change_password: true,
        temp_password_expiry: new Date(Date.now() + 48 * 3600_000).toISOString(),
      })
      .select()
      .single();
    if (userError) throw userError;

    await admin.from("member").insert({
      user_id: appUser.user_id,
      gym_id: gymId,
      preferred_shift: preferredShift ?? "full",
      goal: goal ?? null,
    });

    const { data: plan } = await admin.from("plan").select("*").eq("plan_id", planId).single();
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + plan.duration_days * 86400_000);

    const { data: subscription } = await admin
      .from("subscription")
      .insert({
        gym_id: gymId,
        member_id: appUser.user_id,
        plan_id: planId,
        start_date: startDate.toISOString().slice(0, 10),
        end_date: endDate.toISOString().slice(0, 10),
        status: "active",
      })
      .select()
      .single();

    await admin.from("payment").insert({
      gym_id: gymId,
      sub_id: subscription.sub_id,
      amount: amountPaid ?? plan.price,
      mode: paymentMode ?? "cash",
      reference: `${publicId}-JOIN`,
    });

    await admin.rpc("assign_trainer", { p_member: appUser.user_id });

    const { data: refreshedMember } = await admin
      .from("member")
      .select("assigned_trainer_id, waitlisted")
      .eq("user_id", appUser.user_id)
      .single();

    const notifications = [
      { gym_id: gymId, user_id: appUser.user_id, type: "welcome", message: "Welcome to the gym. Your membership is active." },
    ];
    const { data: owner } = await admin.from("app_user").select("user_id").eq("gym_id", gymId).eq("role", "owner").limit(1).maybeSingle();
    if (owner) {
      notifications.push({
        gym_id: gymId,
        user_id: owner.user_id,
        type: "new_member",
        message: refreshedMember?.waitlisted
          ? `${name} joined and is waitlisted (no trainer capacity available).`
          : `${name} joined and was assigned a trainer.`,
      });
    }
    if (refreshedMember?.assigned_trainer_id) {
      notifications.push({
        gym_id: gymId,
        user_id: refreshedMember.assigned_trainer_id,
        type: "new_member",
        message: `${name} was assigned to you as a new member.`,
      });
    }
    await admin.from("notification").insert(notifications);

    return jsonResponse({
      publicId,
      email,
      temporaryPassword: tempPassword,
      expiresInHours: 48,
      waitlisted: refreshedMember?.waitlisted ?? false,
    });
  } catch {
    return jsonResponse({ error: "We could not create the member. Please try again." }, 500);
  }
});
