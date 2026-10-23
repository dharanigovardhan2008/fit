import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Chip";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/States";
import { useToast } from "../../components/ui/Toast";
import { decideChangeRequest } from "../../lib/backend";
import { formatDateTime } from "../../lib/format";

export default function OwnerRequests() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();

  const requests = useMemo(() => {
    if (!db || !session) return [];
    return db.changeRequests
      .filter((r) => r.gymId === session.gymId && r.status === "pending")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => {
        const isTrainerSuggestion = r.submittedBy === "trainer" && r.fromTrainer === r.memberId;
        const subject = isTrainerSuggestion
          ? db.users.find((u) => u.userId === r.fromTrainer)
          : db.users.find((u) => u.userId === r.memberId);
        return { request: r, subject, isTrainerSuggestion };
      });
  }, [db, session]);

  async function decide(reqId: string, decision: "approved" | "rejected") {
    if (!session) return;
    try {
      await decideChangeRequest(session.gymId, reqId, decision, session.userId);
      invalidate();
      notify(decision === "approved" ? "Request approved" : "Request rejected");
    } catch {
      notify("We could not update this request.", "error");
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Requests" description="Approve trainer changes and member suggestions from trainers." />

      {requests.length === 0 ? (
        <EmptyState title="No pending requests" description="Change-trainer requests and trainer-submitted members will appear here." />
      ) : (
        <div className="grid gap-3">
          {requests.map(({ request, subject, isTrainerSuggestion }) => (
            <Card key={request.reqId} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <Badge tone="neutral">{isTrainerSuggestion ? "New member suggestion" : "Change trainer"}</Badge>
                  <span className="text-[11px] text-text-secondary">{formatDateTime(request.createdAt)}</span>
                </div>
                <p className="text-[14px] font-semibold">{subject?.name ?? "Request"}</p>
                <p className="text-[12px] text-text-secondary">{request.reason || "No reason provided."}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => decide(request.reqId, "rejected")}>
                  <X size={14} /> Reject
                </Button>
                <Button size="sm" onClick={() => decide(request.reqId, "approved")}>
                  <Check size={14} /> Approve
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
