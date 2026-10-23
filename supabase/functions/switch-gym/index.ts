// Edge Function: switch-gym
// Makes one of the caller's gyms the active one. The caller must have an account in that gym.
// After this call the app refreshes its token so the new gym takes effect.
import { adminClient, setActiveGym } from "../_shared/client.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const admin = adminClient();
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data } = await admin.auth.getUser(token);
    if (!data?.user) return jsonResponse({ error: "Please sign in again." }, 401);

    const { gymId } = await req.json();
    const { data: row } = await admin
      .from("app_user")
      .select("role")
      .eq("auth_id", data.user.id)
      .eq("gym_id", gymId)
      .eq("is_active", true)
      .maybeSingle();
    if (!row) return jsonResponse({ error: "You do not have access to that gym." }, 403);

    await setActiveGym(admin, data.user.id, gymId, row.role);
    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: "We could not switch gyms. Please try again." }, 500);
  }
});
