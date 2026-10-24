// Edge Function: cashfree-order
// Starts an online payment on Cashfree and returns the payment session to open.
//  - owner  { kind: "member", member: {...form}, returnUrl }  pays to join a new member
//  - member { kind: "renewal", planId, usePoints, returnUrl } pays to renew their own plan
import { getCaller, normalizePhone, phoneTaken } from "../_shared/client.ts";
import { cashfreeConfig } from "../_shared/cashfree.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  try {
    const { admin, caller } = await getCaller(req);
    if (!caller) return jsonResponse({ error: "Please sign in again." }, 401);
    const cf = cashfreeConfig();
    if (!cf) return jsonResponse({ error: "Online payment is not set up yet." }, 503);

    const body = await req.json();
    const kind = body.kind;
    const returnUrl = String(body.returnUrl ?? "");
    if (!returnUrl.startsWith("http") || !returnUrl.includes("{order_id}")) {
      return jsonResponse({ error: "Invalid return address." }, 400);
    }

    let amount = 0;
    let payload: Record<string, unknown> = {};
    let customer = { name: caller.name, email: caller.email, phone: normalizePhone(caller.phone) };

    if (kind === "member") {
      if (caller.role !== "owner") return jsonResponse({ error: "You do not have permission to do this." }, 403);
      const m = body.member ?? {};
      const email = String(m.email ?? "").trim().toLowerCase();
      const phone = normalizePhone(m.phone);
      if (!String(m.name ?? "").trim() || !email || !m.planId) {
        return jsonResponse({ error: "Name, email and plan are required." }, 400);
      }
      const { data: plan } = await admin.from("plan").select("price").eq("plan_id", m.planId).eq("gym_id", caller.gym_id).maybeSingle();
      if (!plan) return jsonResponse({ error: "Please choose a valid plan." }, 400);
      if (phone && (await phoneTaken(admin, phone, caller.gym_id))) {
        return jsonResponse({ error: "A user with this phone number already exists." }, 409);
      }
      const { data: existing } = await admin.from("app_user").select("user_id").eq("gym_id", caller.gym_id).eq("email", email).maybeSingle();
      if (existing) return jsonResponse({ error: "A user with this email already exists." }, 409);
      amount = Number(m.amountPaid) > 0 ? Number(m.amountPaid) : Number(plan.price);
      payload = { ...m, email, phone, name: String(m.name).trim() };
      customer = { name: String(m.name).trim(), email, phone };
    } else if (kind === "renewal") {
      if (caller.role !== "member") return jsonResponse({ error: "Only members can pay for their own renewal." }, 403);
      const { data: quote, error } = await admin.rpc("quote_renewal", {
        p_member: caller.user_id, p_plan: body.planId, p_use_points: body.usePoints === true,
      });
      if (error || !quote) return jsonResponse({ error: "We could not price this plan." }, 400);
      amount = Number(quote.payable);
      payload = { planId: body.planId, usePoints: body.usePoints === true };
    } else {
      return jsonResponse({ error: "Unknown payment type." }, 400);
    }

    if (!(amount >= 1)) return jsonResponse({ error: "The amount to pay must be at least ₹1." }, 400);

    const orderId = `OF${Date.now()}${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const res = await fetch(`${cf.base}/orders`, {
      method: "POST",
      headers: cf.headers,
      body: JSON.stringify({
        order_id: orderId,
        order_amount: Number(amount.toFixed(2)),
        order_currency: "INR",
        customer_details: {
          customer_id: caller.user_id,
          customer_name: customer.name || "Customer",
          customer_email: customer.email || undefined,
          customer_phone: (customer.phone ?? "").slice(-10).length === 10 ? customer.phone!.slice(-10) : "9999999999",
        },
        order_meta: { return_url: returnUrl },
        order_note: kind === "member" ? "New member joining fee" : "Membership renewal",
      }),
    });
    const order = await res.json();
    if (!res.ok || !order.payment_session_id) {
      return jsonResponse({ error: order?.message ?? "The payment could not be started. Please try again." }, 502);
    }

    await admin.from("payment_order").insert({
      order_id: orderId, gym_id: caller.gym_id, created_by: caller.user_id, kind, amount, payload,
    });

    return jsonResponse({ orderId, paymentSessionId: order.payment_session_id, mode: cf.production ? "production" : "sandbox", amount });
  } catch {
    return jsonResponse({ error: "The payment could not be started. Please try again." }, 500);
  }
});
