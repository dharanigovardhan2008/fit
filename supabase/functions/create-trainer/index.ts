// Edge Function: create-trainer (owner only)
// Creates the Auth user, app_user (T.....) and trainer row with a random temporary password.
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
    const { name, age, gender, phone: rawPhone, email: rawEmail, salary, specialty, shift, maxCapacity } = body;
    const email = String(rawEmail ?? "").trim().toLowerCase();
    const phone = normalizePhone(rawPhone);
    if (!name || !email) return jsonResponse({ error: "Name and email are required." }, 400);

    if (phone && (await phoneTaken(admin, phone, gymId))) {
      return jsonResponse({ error: "A user with this phone number already exists." }, 409);
    }

    const tempPassword = randomPassword(14);

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      app_metadata: { gym_id: gymId, role: "trainer" },
    });
    if (authError) {
      return jsonResponse({ error: "A user with this email already exists." }, 409);
    }

    const { data: publicId } = await admin.rpc("next_public_id", { p_gym: gymId, p_role: "trainer" });

    const { data: appUser, error: userError } = await admin
      .from("app_user")
      .insert({
        auth_id: authUser.user.id,
        gym_id: gymId,
        public_id: publicId,
        role: "trainer",
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

    await admin.from("trainer").insert({
      user_id: appUser.user_id,
      gym_id: gymId,
      salary: salary ?? 0,
      specialty: specialty ?? null,
      shift: shift ?? "full",
      max_capacity: maxCapacity ?? 25,
    });

    return jsonResponse({
      publicId,
      email,
      temporaryPassword: tempPassword,
      expiresInHours: 48,
    });
  } catch {
    return jsonResponse({ error: "We could not create the trainer. Please try again." }, 500);
  }
});
