import { useMemo } from "react";
import { MessageCircle } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Chip";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/States";
import { useToast } from "../../components/ui/Toast";
import { recomputeChurnAlerts } from "../../lib/backend";
import { initials } from "../../lib/format";

export default function OwnerAlerts() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();

  const alerts = useMemo(() => {
    if (!db || !session) return [];
    return db.churnAlerts
      .filter((a) => a.gymId === session.gymId)
      .map((a) => ({ alert: a, member: db.users.find((u) => u.userId === a.memberId) }))
      .sort((a, b) => b.alert.riskScore - a.alert.riskScore);
  }, [db, session]);

  function refresh() {
    if (!session) return;
    recomputeChurnAlerts(session.gymId);
    invalidate();
    notify("Churn alerts refreshed");
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader
        title="Alerts"
        description="Members showing signs of leaving, ranked by risk."
        action={<Button variant="secondary" onClick={refresh}>Recalculate</Button>}
      />

      {alerts.length === 0 ? (
        <EmptyState title="No one is at risk right now" description="When members show signs of leaving, they will be listed here with reasons." />
      ) : (
        <div className="grid gap-3">
          {alerts.map(({ alert, member }) => (
            <Card key={alert.alertId} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-thumb text-[12px] font-semibold">
                  {initials(member?.name ?? "")}
                </div>
                <div>
                  <p className="text-[14px] font-semibold">{member?.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {alert.reasons.map((r) => (
                      <span key={r} className="rounded-full bg-thumb px-2 py-0.5 text-[10px] text-text-secondary">{r}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={alert.riskScore > 0.8 ? "danger" : "warning"}>{Math.round(alert.riskScore * 100)}% risk</Badge>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => notify(`Message queued for ${member?.name}`)}
                >
                  <MessageCircle size={14} /> Message
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
