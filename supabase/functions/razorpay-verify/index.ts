// Edge Function: razorpay-verify (member only)
// Checks the Razorpay signature, then renews the subscription (and spends the points).
import { getCaller } from "../_shared/client.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  try {
    const { admin, caller } = await getCaller(req);
    if (!caller) return jsonResponse({ error: "Please sign in again." }, 401);
    if (caller.role !== "member") return jsonResponse({ error: "Only members can pay online." }, 403);

    const keyId = Deno.env.get("RAZORPAY_KEY_ID")!;
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    const { orderId, paymentId, signature } = await req.json();
    if (!orderId || !paymentId || !signature) return jsonResponse({ error: "Missing payment details." }, 400);

    const expected = await hmacHex(`${orderId}|${paymentId}`, keySecret);
    if (expected !== signature) return jsonResponse({ error: "Payment could not be verified." }, 400);

    // Read what this order was for from Razorpay itself, not from the browser.
    const res = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
      headers: { Authorization: "Basic " + btoa(`${keyId}:${keySecret}`) },
    });
    const order = await res.json();
    if (!res.ok || order.notes?.member_id !== caller.user_id) {
      return jsonResponse({ error: "Payment could not be verified." }, 400);
    }

    const { data, error } = await admin.rpc("complete_renewal", {
      p_member: caller.user_id,
      p_plan: order.notes.plan_id,
      p_use_points: order.notes.use_points === "1",
      p_mode: "upi",
      p_reference: paymentId,
    });
    if (error) return jsonResponse({ error: "Payment received but renewal failed. Contact your gym with payment ID " + paymentId }, 500);
    return jsonResponse({ ok: true, endDate: data?.end_date });
  } catch {
    return jsonResponse({ error: "We could not confirm the payment. If money was deducted, contact your gym." }, 500);
  }
});
