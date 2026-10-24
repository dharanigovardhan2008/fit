import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardTitle } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Chip";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Textarea } from "../../components/ui/Input";
import { EmptyState } from "../../components/ui/States";
import { useToast } from "../../components/ui/Toast";
import { submitChangeRequest, daysBetween, todayStr, startRenewalPayment, quoteRenewal } from "../../lib/backend";
import { Dropdown } from "../../components/ui/Dropdown";
import { useMyPoints } from "./MemberRewards";
import type { RenewalQuote } from "../../types";
import { formatCurrency, formatDate } from "../../lib/format";

export default function MemberSubscription() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();
  const [showRenew, setShowRenew] = useState(false);
  const [note, setNote] = useState("");
  const [showPay, setShowPay] = useState(false);
  const [payPlanId, setPayPlanId] = useState("");
  const [usePoints, setUsePoints] = useState(true);
  const [quote, setQuote] = useState<RenewalQuote | null>(null);
  const [paying, setPaying] = useState(false);
  const { data: points } = useMyPoints();

  const subs = useMemo(
    () => (db?.subscriptions ?? []).filter((s) => s.memberId === session?.userId).sort((a, b) => b.endDate.localeCompare(a.endDate)),
    [db, session],
  );
  const payments = useMemo(
    () => (db?.payments ?? []).filter((p) => subs.some((s) => s.subId === p.subId)).sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
    [db, subs],
  );
  const current = subs[0];
  const plan = db?.plans.find((p) => p.planId === current?.planId);
  const daysLeft = current ? daysBetween(todayStr(), current.endDate) : null;
  const gymPlans = (db?.plans ?? []).filter((p) => p.gymId === session?.gymId);

  useEffect(() => {
    if (!showPay || !session || !payPlanId) return;
    let cancelled = false;
    setQuote(null);
    quoteRenewal(session.userId, payPlanId, usePoints)
      .then((q) => { if (!cancelled) setQuote(q); })
      .catch(() => { if (!cancelled) setQuote(null); });
    return () => { cancelled = true; };
  }, [showPay, payPlanId, usePoints, session]);

  async function pay() {
    if (!session) return;
    setPaying(true);
    try {
      // Opens the Cashfree page. The plan is renewed when you come back after paying.
      await startRenewalPayment(payPlanId, usePoints);
    } catch (err) {
      notify(err instanceof Error ? err.message : "The payment could not be completed.", "error");
      setPaying(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Subscription" description="Your plan details and payment history." />

      {current && (
        <Card className="bg-ink text-on-ink">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] text-white/60">{plan?.name}</p>
              <p className="text-[20px] font-semibold">{daysLeft != null && daysLeft >= 0 ? `${daysLeft} days left` : "Expired"}</p>
            </div>
            <Button
              variant="secondary"
              className="border-white/30 bg-white text-ink"
              onClick={() => {
                setPayPlanId(current.planId);
                setShowPay(true);
              }}
            >
              Renew online
            </Button>
          </div>
          <p className="mt-3 text-[12px] text-white/70">Started {formatDate(current.startDate)}, ends {formatDate(current.endDate)}</p>
          <button type="button" onClick={() => setShowRenew(true)} className="mt-2 text-[12px] text-white/70 underline underline-offset-2">
            Or ask the gym to renew it
          </button>
        </Card>
      )}

      <Card>
        <CardTitle>Subscription history</CardTitle>
        {subs.length === 0 ? (
          <EmptyState title="No subscriptions yet" description="Your membership history will appear here once you join a plan." />
        ) : (
          <ul className="mt-3 divide-y divide-track">
            {subs.map((s) => {
              const p = db?.plans.find((pl) => pl.planId === s.planId);
              return (
                <li key={s.subId} className="flex items-center justify-between py-3 text-[13px]">
                  <span>{p?.name} - {formatDate(s.startDate)} to {formatDate(s.endDate)}</span>
                  <Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>Payment history</CardTitle>
        {payments.length === 0 ? (
          <EmptyState title="No payments recorded" description="Your payments will be listed here." />
        ) : (
          <ul className="mt-3 divide-y divide-track">
            {payments.map((p) => (
              <li key={p.paymentId} className="flex items-center justify-between py-3 text-[13px]">
                <span className="capitalize">{p.mode} - {formatDate(p.paidAt)}</span>
                <span className="font-medium">{formatCurrency(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={showPay} onClose={() => setShowPay(false)} title="Renew online">
        <div className="flex flex-col gap-4">
          <Dropdown
            id="pay-plan"
            label="Plan"
            value={payPlanId}
            onChange={setPayPlanId}
            options={gymPlans.map((p) => ({ value: p.planId, label: `${p.name} - ${formatCurrency(p.price)}` }))}
          />
          {points && points.balance > 0 && (
            <label className="flex items-center gap-3 rounded-2xl bg-thumb px-4 py-3 text-[13px]">
              <input type="checkbox" className="h-4 w-4 accent-[#2b2b2b]" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} />
              <span>Use my {points.balance} reward points</span>
            </label>
          )}
          <div className="rounded-2xl bg-thumb p-4 text-[13px]">
            {quote ? (
              <>
                <div className="flex justify-between"><span className="text-text-secondary">Plan price</span><span>{formatCurrency(quote.price)}</span></div>
                {quote.discount > 0 && (
                  <div className="mt-1 flex justify-between text-success"><span>Points discount ({quote.pointsUsed} pts)</span><span>- {formatCurrency(quote.discount)}</span></div>
                )}
                <div className="mt-2 flex justify-between border-t border-track pt-2 text-[15px] font-semibold"><span>You pay</span><span>{formatCurrency(quote.payable)}</span></div>
              </>
            ) : (
              <p className="text-text-secondary">Calculating price...</p>
            )}
          </div>
          <Button size="lg" fullWidth loading={paying} disabled={!quote || !payPlanId} onClick={pay}>
            Pay {quote ? formatCurrency(quote.payable) : ""}
          </Button>
          <p className="text-center text-[11px] text-text-secondary">Pay with UPI, card or net banking on the secure Cashfree page.</p>
        </div>
      </Modal>

      <Modal open={showRenew} onClose={() => setShowRenew(false)} title="Request renewal">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!session) return;
            await submitChangeRequest(session.gymId, session.userId, `Renewal request: ${note || "please renew my plan"}`, "member");
            invalidate();
            notify("Renewal request sent to the owner");
            setShowRenew(false);
            setNote("");
          }}
        >
          <Textarea id="renew-note" label="Note for the owner (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit" fullWidth>Send request</Button>
        </form>
      </Modal>
    </div>
  );
}
