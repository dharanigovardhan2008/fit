// Edge Function: login
// Input: { gymId, identifier, password }. The identifier can be the user ID (M2601), the email, or
// the mobile number, looked up inside the chosen gym. Signs in with Supabase Auth and returns the
// session. Wrong id and wrong password share one message so the form cannot be used to find accounts.
import { adminClient, anonClient, setActiveGym } from "../_shared/client.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

const GENERIC_ERROR = "Incorrect ID or password";
const LOCK_MINUTES = 15;
const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { gymId, identifier, password } = await req.json();
    const id = String(identifier ?? "").trim();
    if (!gymId || !id || !password) return jsonResponse({ error: GENERIC_ERROR }, 400);

    const admin = adminClient();
    let query = admin
      .from("app_user")
      .select("user_id, auth_id, role, email, failed_attempts, locked_until, is_active, must_change_password")
      .eq("gym_id", gymId);

    if (id.includes("@")) {
      query = query.eq("email", id.toLowerCase());
    } else if (/^[A-Za-z]\d+$/.test(id)) {
      query = query.eq("public_id", id.toUpperCase());
    } else {
      const digits = id.replace(/\D/g, "");
      if (digits.length < 10) return jsonResponse({ error: GENERIC_ERROR }, 401);
      query = query.like("phone", `%${digits.slice(-10)}`);
    }

    const { data: matches } = await query.limit(2);
    if (!matches || matches.length !== 1) return jsonResponse({ error: GENERIC_ERROR }, 401);
    const user = matches[0];
    if (!user.is_active) return jsonResponse({ error: GENERIC_ERROR }, 401);

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return jsonResponse({ error: "Account locked. Try again in a few minutes." }, 423);
    }

    const anon = anonClient();
    let { data: session, error } = await anon.auth.signInWithPassword({ email: user.email, password });

    if (error || !session?.session) {
      const attempts = (user.failed_attempts ?? 0) + 1;
      const patch: Record<string, unknown> = { failed_attempts: attempts };
      if (attempts >= MAX_ATTEMPTS) {
        patch.locked_until = new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString();
        patch.failed_attempts = 0;
      }
      await admin.from("app_user").update(patch).eq("user_id", user.user_id);
      return jsonResponse({ error: GENERIC_ERROR }, 401);
    }

    // The password is right. Make this gym the active one in the token (an owner may have several).
    const currentGym = session.session.user.app_metadata?.gym_id;
    if (currentGym !== gymId) {
      await setActiveGym(admin, user.auth_id, gymId, user.role);
      const again = await anon.auth.signInWithPassword({ email: user.email, password });
      if (again.error || !again.data.session) return jsonResponse({ error: GENERIC_ERROR }, 500);
      session = again.data;
    }

    await admin
      .from("app_user")
      .update({ failed_attempts: 0, locked_until: null })
      .eq("user_id", user.user_id);

    return jsonResponse({
      session: session!.session,
      mustChangePassword: user.must_change_password,
    });
  } catch {
    return jsonResponse({ error: GENERIC_ERROR }, 500);
  }
});
