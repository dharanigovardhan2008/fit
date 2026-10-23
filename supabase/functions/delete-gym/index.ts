// Edge Function: delete-gym (owner only)
// Permanently deletes the ACTIVE gym and everything in it: members, trainers, attendance, payments.
// The owner's other gyms are untouched. Returns the gym to switch to, if the owner has another one.
import { getCaller, setActiveGym } from "../_shared/client.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { admin, caller } = await getCaller(req);
    if (!caller) return jsonResponse({ error: "Please sign in again." }, 401);
    if (caller.role !== "owner") {
      return jsonResponse({ error: "You do not have permission to do this." }, 403);
    }

    const { confirm } = await req.json();
    if (confirm !== "DELETE") return jsonResponse({ error: "Type DELETE to confirm." }, 400);

    const { data: people } = await admin.from("app_user").select("auth_id").eq("gym_id", caller.gym_id);

    const { error } = await admin.from("gym").delete().eq("gym_id", caller.gym_id);
    if (error) throw error;

    // Remove sign-in accounts that no longer belong to any gym.
    for (const person of people ?? []) {
      if (!person.auth_id) continue;
      const { count } = await admin
        .from("app_user").select("user_id", { count: "exact", head: true }).eq("auth_id", person.auth_id);
      if ((count ?? 0) === 0) await admin.auth.admin.deleteUser(person.auth_id);
    }

    // If the owner has another gym, make it the active one.
    const { data: next } = await admin
      .from("app_user").select("gym_id, role").eq("auth_id", caller.auth_id).eq("is_active", true).limit(1).maybeSingle();
    if (next) await setActiveGym(admin, caller.auth_id, next.gym_id, next.role);

    return jsonResponse({ ok: true, nextGymId: next?.gym_id ?? null });
  } catch {
    return jsonResponse({ error: "We could not delete the gym. Please try again." }, 500);
  }
});
