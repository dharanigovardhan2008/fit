import { useState } from "react";
import { Check, Salad, Dumbbell } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Chip";
import { EmptyState } from "../../components/ui/States";
import { useToast } from "../../components/ui/Toast";
import { addDaysPublic, setPlanDone, todayStr } from "../../lib/backend";
import { formatDate } from "../../lib/format";

export default function MemberPlans() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const today = todayStr();
  const plans = (db?.memberPlans ?? [])
    .filter((p) => p.memberId === session?.userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const last7 = Array.from({ length: 7 }, (_, i) => addDaysPublic(today, i - 6));

  async function toggle(planId: string, done: boolean) {
    if (!session) return;
    setBusy(planId);
    try {
      await setPlanDone(session, planId, today, !done);
      invalidate();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not save. Try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="My Plans" description="Diet and workout plans from your trainer. Tick them off each day." />

      {plans.length === 0 ? (
        <EmptyState title="No plans yet" description="When your trainer assigns a diet or workout plan, it will show up here." />
      ) : (
        <div className="grid gap-4">
          {plans.map((p) => {
            const days = new Set((db?.memberPlanLogs ?? []).filter((l) => l.planId === p.id).map((l) => l.logDate));
            const done = days.has(today);
            return (
              <Card key={p.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-thumb">
                      {p.kind === "diet" ? <Salad size={18} /> : <Dumbbell size={18} />}
                    </span>
                    <div>
                      <p className="text-[15px] font-semibold">{p.title}</p>
                      <p className="text-[11px] text-text-secondary">Added {formatDate(p.createdAt)}</p>
                    </div>
                  </div>
                  <Badge tone="neutral">{p.kind}</Badge>
                </div>
                <p className="whitespace-pre-wrap text-[13px] leading-6 text-text-primary">{p.content}</p>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex gap-1.5" aria-label="Last 7 days">
                    {last7.map((d) => (
                      <span
                        key={d}
                        title={d}
                        className={`h-2.5 w-2.5 rounded-full ${days.has(d) ? "bg-success" : "bg-track"}`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={busy === p.id}
                    onClick={() => toggle(p.id, done)}
                    className={`flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-medium transition-colors ${
                      done ? "bg-success/10 text-success" : "bg-ink text-on-ink"
                    }`}
                  >
                    <Check size={16} /> {done ? "Done today" : "Mark done"}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
