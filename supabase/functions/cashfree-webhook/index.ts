// Edge Function: cashfree-webhook (deploy with --no-verify-jwt)
// Cashfree calls this when a payment succeeds, even if the person closed the browser.
// It checks Cashfree's signature, ignores orders that belong to other products, and finishes the job.
import { adminClient } from "../_shared/client.ts";
import { cashfreeConfig } from "../_shared/cashfree.ts";
import { settleOrder } from "../_shared/payments.ts";

async function sign(timestamp: string, rawBody: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(timestamp + rawBody));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

Deno.serve(async (req) => {
  const ok = () => new Response("ok", { status: 200 });
  try {
    const cf = cashfreeConfig();
    const secret = Deno.env.get("CASHFREE_SECRET_KEY");
    if (!cf || !secret) return new Response("not configured", { status: 503 });

    const rawBody = await req.text();
    const signature = req.headers.get("x-webhook-signature") ?? "";
    const timestamp = req.headers.get("x-webhook-timestamp") ?? "";
    // Cashfree's "Test" button in the dashboard may send a bare ping. Answer it so the URL can be saved.
    if (!signature && !timestamp) return ok();
    if ((await sign(timestamp, rawBody, secret)) !== signature) return new Response("bad signature", { status: 401 });

    const body = JSON.parse(rawBody);
    const orderId = body?.data?.order?.order_id;
    const paid = body?.data?.payment?.payment_status === "SUCCESS" || String(body?.type ?? "").includes("SUCCESS");
    if (!orderId || !paid) return ok();

    // Orders from the owner's other products also arrive here. settleOrder ignores ids it does not know.
    await settleOrder(adminClient(), cf, orderId, true);
    return ok();
  } catch {
    // A 500 makes Cashfree try again later, which is what we want for a temporary problem.
    return new Response("error", { status: 500 });
  }
});
