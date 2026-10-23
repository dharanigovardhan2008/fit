import { useMemo } from "react";
import { MessageCircle } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Chip";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/States";
import { useToast } from "../../components/ui/Toast";
import { initials } from "../../lib/format";

export default function TrainerAlerts() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const { notify } = useToast();

  const alerts = useMemo(() => {
    if (!db || !session) return [];
    const myMemberIds = new Set(db.members.filter((m) => m.assignedTrainerId === session.userId).map((m) => m.userId));
    return db.churnAlerts
      .filter((a) => myMemberIds.has(a.memberId))
      .map((a) => ({ alert: a, member: db.users.find((u) => u.userId === a.memberId) }))
      .sort((a, b) => b.alert.riskScore - a.alert.riskScore);
  }, [db, session]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Alerts" description="Your members who may be at risk of leaving." />

      {alerts.length === 0 ? (
        <EmptyState title="No one is at risk right now" description="Members showing signs of leaving will be listed here." />
      ) : (
        <div className="grid gap-3">
          {alerts.map(({ alert, member }) => (
            <Card key={alert.alertId} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-thumb text-[12px] font-semibold">
                  {initials(member?.name ?? "")}
                </div>
                <div>
                  <p className="text-[14px] font-semibold">{member?.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {alert.reasons.map((r) => <span key={r} className="rounded-full bg-thumb px-2 py-0.5 text-[10px] text-text-secondary">{r}</span>)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={alert.riskScore > 0.8 ? "danger" : "warning"}>{Math.round(alert.riskScore * 100)}%</Badge>
                <Button size="sm" variant="secondary" onClick={() => notify(`Message queued for ${member?.name}`)}>
                  <MessageCircle size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
