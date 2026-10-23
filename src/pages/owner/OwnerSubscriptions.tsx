import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Chip, Badge } from "../../components/ui/Chip";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Input, Select } from "../../components/ui/Input";
import { EmptyState } from "../../components/ui/States";
import { useToast } from "../../components/ui/Toast";
import { renewSubscription, daysBetween, todayStr } from "../../lib/backend";
import { formatCurrency, formatDate } from "../../lib/format";
import type { Subscription } from "../../types";

export default function OwnerSubscriptions() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();
  const [tab, setTab] = useState<"active" | "expiring" | "expired">("active");
  const [renewing, setRenewing] = useState<Subscription | null>(null);

  const plans = (db?.plans ?? []).filter((p) => p.gymId === session?.gymId);

  const rows = useMemo(() => {
    if (!db || !session) return [];
    const today = todayStr();
    const latestByMember = new Map<string, Subscription>();
    db.subscriptions.filter((s) => s.gymId === session.gymId).forEach((s) => {
      const existing = latestByMember.get(s.memberId);
      if (!existing || s.endDate > existing.endDate) latestByMember.set(s.memberId, s);
    });
    return Array.from(latestByMember.values())
      .map((s) => {
        const member = db.users.find((u) => u.userId === s.memberId);
        const plan = db.plans.find((p) => p.planId === s.planId);
        const daysLeft = daysBetween(today, s.endDate);
        return { sub: s, member, plan, daysLeft };
      })
      .filter((row) => {
        if (tab === "active") return row.sub.status === "active" && row.daysLeft > 7;
        if (tab === "expiring") return row.sub.status === "active" && row.daysLeft >= 0 && row.daysLeft <= 7;
        return row.sub.status === "expired" || row.daysLeft < 0;
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [db, session, tab]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Subscriptions" description="Track membership status and collect renewals." />

      <div className="flex gap-2 overflow-x-auto">
        {(["active", "expiring", "expired"] as const).map((key) => (
          <Chip key={key} active={tab === key} onClick={() => setTab(key)}>
            {key[0].toUpperCase() + key.slice(1)}
          </Chip>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nothing here" description="There are no subscriptions in this view right now." />
      ) : (
        <div className="grid gap-3">
          {rows.map(({ sub, member, plan, daysLeft }) => (
            <Card key={sub.subId} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[14px] font-semibold">{member?.name}</p>
                <p className="text-[12px] text-text-secondary">
                  {plan?.name} - ends {formatDate(sub.endDate)} ({daysLeft >= 0 ? `${daysLeft} days left` : `${Math.abs(daysLeft)} days ago`})
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={sub.status === "active" && daysLeft >= 0 ? (daysLeft <= 7 ? "warning" : "success") : "danger"}>
                  {sub.status === "active" && daysLeft >= 0 ? (daysLeft <= 7 ? "Expiring" : "Active") : "Expired"}
                </Badge>
                <Button size="sm" variant="secondary" onClick={() => setRenewing(sub)}>Renew</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!renewing} onClose={() => setRenewing(null)} title="Renew subscription">
        {renewing && session && (
          <RenewForm
            plans={plans}
            currentPlanId={renewing.planId}
            onCancel={() => setRenewing(null)}
            onSave={async (planId, amount, mode) => {
              try {
                await renewSubscription(session.gymId, renewing.memberId, planId, amount, mode);
                invalidate();
                notify("Subscription renewed");
                setRenewing(null);
              } catch (err) {
                notify(err instanceof Error ? err.message : "We could not renew this subscription.", "error");
              }
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function RenewForm({
  plans, currentPlanId, onSave, onCancel,
}: {
  plans: { planId: string; name: string; durationDays: number; price: number }[];
  currentPlanId: string;
  onSave: (planId: string, amount: number, mode: "cash" | "upi" | "card") => void;
  onCancel: () => void;
}) {
  const [planId, setPlanId] = useState(currentPlanId);
  const [mode, setMode] = useState<"cash" | "upi" | "card">("cash");
  const selectedPlan = plans.find((p) => p.planId === planId);
  const [amount, setAmount] = useState(String(selectedPlan?.price ?? ""));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(planId, Number(amount), mode);
      }}
    >
      <Select id="r-plan" label="Plan" value={planId} onChange={(e) => {
        setPlanId(e.target.value);
        const p = plans.find((pl) => pl.planId === e.target.value);
        if (p) setAmount(String(p.price));
      }}>
        {plans.map((p) => <option key={p.planId} value={p.planId}>{p.name} - {formatCurrency(p.price)}</option>)}
      </Select>
      <Input id="r-amount" label="Amount received" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Select id="r-mode" label="Payment mode" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
        <option value="cash">Cash</option>
        <option value="upi">UPI</option>
        <option value="card">Card</option>
      </Select>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" fullWidth onClick={onCancel}>Cancel</Button>
        <Button type="submit" fullWidth>Confirm renewal</Button>
      </div>
    </form>
  );
}
