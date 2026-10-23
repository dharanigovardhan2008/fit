// Edge Function: delete-user (owner only)
// Permanently removes a trainer or member: their profile, sign-in account, attendance, payments
// and ratings. Members of a removed trainer are assigned to another trainer (or waitlisted).
import { getCaller } from "../_shared/client.ts";
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

    const { userId } = await req.json();
    if (!userId) return jsonResponse({ error: "Choose who to remove." }, 400);

    const { data: target } = await admin
      .from("app_user")
      .select("user_id, auth_id, role, gym_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!target || target.gym_id !== caller.gym_id) {
      return jsonResponse({ error: "Person not found." }, 404);
    }
    if (target.role === "owner") {
      return jsonResponse({ error: "The owner account cannot be removed. Delete the gym instead." }, 400);
    }

    // Members that will lose their trainer
    let orphaned: string[] = [];
    if (target.role === "trainer") {
      const { data: rows } = await admin.from("member").select("user_id").eq("assigned_trainer_id", target.user_id);
      orphaned = (rows ?? []).map((r) => r.user_id);
    }

    const { error } = await admin.rpc("remove_person", { p_user: target.user_id });
    if (error) throw error;

    if (target.auth_id) await admin.auth.admin.deleteUser(target.auth_id);

    for (const memberId of orphaned) {
      await admin.rpc("assign_trainer", { p_member: memberId });
    }

    return jsonResponse({ ok: true, reassigned: orphaned.length });
  } catch {
    return jsonResponse({ error: "We could not remove this person. Please try again." }, 500);
  }
});
