// Edge Function: cashfree-verify
// Called when the person comes back from Cashfree. Confirms the payment, then finishes the job.
import { getCaller } from "../_shared/client.ts";
import { cashfreeConfig } from "../_shared/cashfree.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { settleOrder } from "../_shared/payments.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  try {
    const { admin, caller } = await getCaller(req);
    if (!caller) return jsonResponse({ error: "Please sign in again." }, 401);
    const cf = cashfreeConfig();
    if (!cf) return jsonResponse({ error: "Online payment is not set up yet." }, 503);

    const { orderId } = await req.json();
    const { data: row } = await admin.from("payment_order").select("created_by, gym_id").eq("order_id", orderId).maybeSingle();
    if (!row || row.created_by !== caller.user_id || row.gym_id !== caller.gym_id) {
      return jsonResponse({ error: "We could not find this payment." }, 404);
    }

    const result = await settleOrder(admin, cf, orderId, false);
    if (result.error) return jsonResponse({ error: result.error }, result.httpStatus ?? 500);
    return jsonResponse(result);
  } catch {
    return jsonResponse({ error: "We could not confirm the payment. If money was deducted, contact your gym." }, 500);
  }
});
