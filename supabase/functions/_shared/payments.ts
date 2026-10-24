// Finishes an online payment: asks Cashfree if the order is paid, then creates the member or renews the plan.
// Used by cashfree-verify (person returns to the app) and cashfree-webhook (Cashfree tells us).
import { adminClient } from "./client.ts";
import { cashfreeConfig } from "./cashfree.ts";
import { createMemberCore } from "./members.ts";

type Config = NonNullable<ReturnType<typeof cashfreeConfig>>;

export interface SettleResult {
  status: "paid" | "done" | "unpaid" | "failed" | "processing" | "unknown";
  kind?: "member" | "renewal";
  credentials?: { publicId: string; email: string; temporaryPassword: string; expiresInHours: number; waitlisted: boolean };
  name?: string;
  phone?: string;
  endDate?: string;
  error?: string;
  httpStatus?: number;
}

export async function settleOrder(
  admin: ReturnType<typeof adminClient>, cf: Config, orderId: string, viaWebhook: boolean,
): Promise<SettleResult> {
  const { data: row } = await admin.from("payment_order").select("*").eq("order_id", orderId).maybeSingle();
  if (!row) return { status: "unknown" };
  if (row.status === "done") return { status: "done", kind: row.kind };

  const res = await fetch(`${cf.base}/orders/${orderId}`, { headers: cf.headers });
  const order = await res.json();
  if (!res.ok) return { status: "unpaid", kind: row.kind, error: "We could not check the payment. Please try again.", httpStatus: 502 };

  if (order.order_status !== "PAID") {
    const failed = order.order_status === "EXPIRED" || order.order_status === "TERMINATED";
    if (failed) await admin.from("payment_order").update({ status: "failed" }).eq("order_id", orderId);
    return { status: failed ? "failed" : "unpaid", kind: row.kind };
  }

  // Claim the order so the webhook and the returning person cannot both create the member.
  const { data: claimed } = await admin
    .from("payment_order").update({ status: "processing" }).eq("order_id", orderId).in("status", ["created", "failed"]).select("order_id");
  if (!claimed || claimed.length === 0) return { status: "processing", kind: row.kind };

  if (row.kind === "member") {
    const result = await createMemberCore(admin, row.gym_id, {
      ...row.payload, amountPaid: Number(row.amount), paymentMode: "upi", reference: `CF-${orderId}`,
    });
    if (!result.ok) {
      await admin.from("payment_order").update({ status: "failed" }).eq("order_id", orderId);
      await admin.from("notification").insert({
        gym_id: row.gym_id, user_id: row.created_by, type: "payment_problem",
        message: `Payment of Rs ${row.amount} received for ${row.payload.name}, but the member could not be created: ${result.error} Payment ID: ${orderId}`,
      });
      return {
        status: "failed", kind: "member", httpStatus: result.status,
        error: `Payment received but the member could not be created: ${result.error} Keep this payment ID: ${orderId}`,
      };
    }
    await admin.from("payment_order").update({ status: "done" }).eq("order_id", orderId);
    if (viaWebhook) {
      // The owner was not on the page, so leave the login details where they will see them.
      await admin.from("notification").insert({
        gym_id: row.gym_id, user_id: row.created_by, type: "member_paid",
        message: `Payment received. ${row.payload.name} is now a member. Login ID ${result.data.publicId}, temporary password ${result.data.temporaryPassword} (valid ${result.data.expiresInHours} hours).`,
      });
    }
    return { status: "paid", kind: "member", credentials: result.data, name: row.payload.name, phone: row.payload.phone };
  }

  const { data, error } = await admin.rpc("complete_renewal", {
    p_member: row.created_by, p_plan: row.payload.planId, p_use_points: row.payload.usePoints === true,
    p_mode: "upi", p_reference: `CF-${orderId}`,
  });
  if (error) {
    await admin.from("payment_order").update({ status: "failed" }).eq("order_id", orderId);
    return { status: "failed", kind: "renewal", httpStatus: 500, error: `Payment received but the renewal failed. Keep this payment ID: ${orderId}` };
  }
  await admin.from("payment_order").update({ status: "done" }).eq("order_id", orderId);
  return { status: "paid", kind: "renewal", endDate: data?.end_date };
}
