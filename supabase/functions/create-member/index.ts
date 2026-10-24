// Edge Function: create-member (owner only)
// Creates a member when the owner has taken cash. Online payments go through cashfree-order instead.
import { getCaller } from "../_shared/client.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { createMemberCore } from "../_shared/members.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { admin, caller } = await getCaller(req);
    if (!caller) return jsonResponse({ error: "Please sign in again." }, 401);
    if (caller.role !== "owner") return jsonResponse({ error: "You do not have permission to do this." }, 403);

    const body = await req.json();
    const result = await createMemberCore(admin, caller.gym_id, body);
    if (!result.ok) return jsonResponse({ error: result.error }, result.status);
    return jsonResponse(result.data);
  } catch {
    return jsonResponse({ error: "We could not create the member. Please try again." }, 500);
  }
});
