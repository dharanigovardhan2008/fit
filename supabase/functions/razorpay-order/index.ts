// Edge Function: razorpay-order (member only)
// Works out the price (with reward points if asked) and creates a Razorpay order for it.
import { getCaller } from "../_shared/client.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  try {
    const { admin, caller } = await getCaller(req);
    if (!caller) return jsonResponse({ error: "Please sign in again." }, 401);
    if (caller.role !== "member") return jsonResponse({ error: "Only members can pay online." }, 403);

    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) return jsonResponse({ error: "Online payment is not set up yet." }, 503);

    const { planId, usePoints } = await req.json();
    const { data: quote, error } = await admin.rpc("quote_renewal", {
      p_member: caller.user_id, p_plan: planId, p_use_points: usePoints === true,
    });
    if (error || !quote) return jsonResponse({ error: "We could not price this plan." }, 400);
    const payable = Number(quote.payable);
    if (payable < 1) return jsonResponse({ error: "Nothing to pay. Ask your gym to renew it." }, 400);

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Basic " + btoa(`${keyId}:${keySecret}`) },
      body: JSON.stringify({
        amount: Math.round(payable * 100),
        currency: "INR",
        receipt: `m_${Date.now()}`,
        notes: { member_id: caller.user_id, plan_id: planId, use_points: usePoints === true ? "1" : "0" },
      }),
    });
    const order = await res.json();
    if (!res.ok) return jsonResponse({ error: "The payment could not be started. Please try again." }, 502);

    return jsonResponse({
      orderId: order.id, amount: order.amount, currency: order.currency, keyId,
      payable, discount: Number(quote.discount), pointsUsed: Number(quote.points_used),
    });
  } catch {
    return jsonResponse({ error: "The payment could not be started. Please try again." }, 500);
  }
});
