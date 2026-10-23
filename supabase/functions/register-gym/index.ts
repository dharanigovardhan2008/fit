// Edge Function: register-gym
// Creates a new gym with its first owner account (O2601) and three default plans.
// An owner who already has an account adds more gyms from inside the app (create-gym).
import { adminClient, generateGymCode, normalizePhone } from "../_shared/client.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = adminClient();
  let gymId: string | null = null;
  let authId: string | null = null;

  try {
    const body = await req.json();
    const { gymName, address, ownerName, ownerPassword, ownerAge, ownerGender } = body;
    const ownerEmail = String(body.ownerEmail ?? "").trim().toLowerCase();
    const ownerPhone = normalizePhone(body.ownerPhone);

    if (!gymName || !ownerName || !ownerEmail || !ownerPassword) {
      return jsonResponse({ error: "Please fill in every required field." }, 400);
    }

    let code = generateGymCode();
    for (let i = 0; i < 5; i++) {
      const { data } = await admin.from("gym").select("gym_id").eq("code", code).maybeSingle();
      if (!data) break;
      code = generateGymCode();
    }

    const { data: gym, error: gymError } = await admin
      .from("gym")
      .insert({ name: gymName, address, code })
      .select()
      .single();
    if (gymError) throw gymError;
    gymId = gym.gym_id;

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
      app_metadata: { gym_id: gym.gym_id, role: "owner" },
    });
    if (authError) {
      throw new Error(/already|registered|exists/i.test(authError.message) ? "EMAIL_TAKEN" : authError.message);
    }
    authId = authUser.user.id;

    const { data: publicIdRow } = await admin.rpc("next_public_id", { p_gym: gym.gym_id, p_role: "owner" });

    const { error: userError } = await admin.from("app_user").insert({
      auth_id: authUser.user.id,
      gym_id: gym.gym_id,
      public_id: publicIdRow,
      role: "owner",
      name: ownerName,
      age: ownerAge ?? null,
      gender: ownerGender ?? null,
      phone: ownerPhone,
      email: ownerEmail,
      must_change_password: false,
    });
    if (userError) throw userError;

    await admin.from("plan").insert([
      { gym_id: gym.gym_id, name: "Monthly", duration_days: 30, price: 1500 },
      { gym_id: gym.gym_id, name: "Quarterly", duration_days: 90, price: 4000 },
      { gym_id: gym.gym_id, name: "Yearly", duration_days: 365, price: 14000 },
    ]);

    return jsonResponse({ gymCode: code, ownerId: publicIdRow, gymId: gym.gym_id });
  } catch (err) {
    // Undo a half-finished registration.
    if (authId) await admin.auth.admin.deleteUser(authId).catch(() => undefined);
    if (gymId) await admin.from("gym").delete().eq("gym_id", gymId).catch(() => undefined);
    if (err instanceof Error && err.message === "EMAIL_TAKEN") {
      return jsonResponse({
        error: "An account with this email already exists. Log in and use \"Add gym\" to create another gym.",
      }, 409);
    }
    return jsonResponse({ error: "We could not complete registration. Please try again." }, 500);
  }
});
