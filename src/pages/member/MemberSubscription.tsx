import { useMemo, useState } from "react";
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
import { submitChangeRequest, daysBetween, todayStr } from "../../lib/backend";
import { formatCurrency, formatDate } from "../../lib/format";

export default function MemberSubscription() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();
  const [showRenew, setShowRenew] = useState(false);
  const [note, setNote] = useState("");

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
            <Button variant="secondary" className="bg-white/10 text-white border-white/20 hover:border-white/40" onClick={() => setShowRenew(true)}>
              Request renewal
            </Button>
          </div>
          <p className="mt-3 text-[12px] text-white/70">Started {formatDate(current.startDate)}, ends {formatDate(current.endDate)}</p>
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
