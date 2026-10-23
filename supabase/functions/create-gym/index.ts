// Edge Function: create-gym (owner only)
// Adds another gym for an owner who is already signed in. The owner keeps one sign-in and gets a
// new owner ID inside the new gym. The new gym becomes the active one.
import { generateGymCode, getCaller, setActiveGym } from "../_shared/client.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  let gymId: string | null = null;
  const { admin, caller } = await getCaller(req);
  try {
    if (!caller) return jsonResponse({ error: "Please sign in again." }, 401);
    if (caller.role !== "owner") {
      return jsonResponse({ error: "You do not have permission to do this." }, 403);
    }

    const { gymName, address } = await req.json();
    if (!gymName || !String(gymName).trim()) return jsonResponse({ error: "Enter the gym name." }, 400);

    let code = generateGymCode();
    for (let i = 0; i < 5; i++) {
      const { data } = await admin.from("gym").select("gym_id").eq("code", code).maybeSingle();
      if (!data) break;
      code = generateGymCode();
    }

    const { data: gym, error: gymError } = await admin
      .from("gym").insert({ name: String(gymName).trim(), address: address ?? null, code }).select().single();
    if (gymError) throw gymError;
    gymId = gym.gym_id;

    const { data: publicId } = await admin.rpc("next_public_id", { p_gym: gym.gym_id, p_role: "owner" });

    const { error: userError } = await admin.from("app_user").insert({
      auth_id: caller.auth_id,
      gym_id: gym.gym_id,
      public_id: publicId,
      role: "owner",
      name: caller.name,
      age: caller.age,
      gender: caller.gender,
      phone: caller.phone,
      email: caller.email,
      must_change_password: false,
    });
    if (userError) throw userError;

    await admin.from("plan").insert([
      { gym_id: gym.gym_id, name: "Monthly", duration_days: 30, price: 1500 },
      { gym_id: gym.gym_id, name: "Quarterly", duration_days: 90, price: 4000 },
      { gym_id: gym.gym_id, name: "Yearly", duration_days: 365, price: 14000 },
    ]);

    await setActiveGym(admin, caller.auth_id, gym.gym_id, "owner");
    return jsonResponse({ ok: true, gymId: gym.gym_id });
  } catch {
    if (gymId) await admin.from("gym").delete().eq("gym_id", gymId).catch(() => undefined);
    return jsonResponse({ error: "We could not create the gym. Please try again." }, 500);
  }
});
