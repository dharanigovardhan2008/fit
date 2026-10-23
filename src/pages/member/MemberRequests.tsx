import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Chip";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Textarea } from "../../components/ui/Input";
import { EmptyState } from "../../components/ui/States";
import { useToast } from "../../components/ui/Toast";
import { submitChangeRequest } from "../../lib/backend";
import { formatDateTime } from "../../lib/format";

export default function MemberRequests() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();
  const [showNew, setShowNew] = useState(false);
  const [reason, setReason] = useState("");

  const requests = useMemo(
    () => (db?.changeRequests ?? []).filter((r) => r.memberId === session?.userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db, session],
  );

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader
        title="Requests"
        description="Ask to change trainers or request a renewal."
        action={<Button onClick={() => setShowNew(true)}><Plus size={16} /> New request</Button>}
      />

      {requests.length === 0 ? (
        <EmptyState title="No requests yet" description="Requests you submit will appear here with their status." />
      ) : (
        <div className="grid gap-3">
          {requests.map((r) => (
            <Card key={r.reqId} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-secondary">{formatDateTime(r.createdAt)}</span>
                <Badge tone={r.status === "pending" ? "warning" : r.status === "approved" ? "success" : "danger"}>{r.status}</Badge>
              </div>
              <p className="text-[13px] text-text-primary">{r.reason}</p>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Request a trainer change">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!session || !reason.trim()) return;
            await submitChangeRequest(session.gymId, session.userId, reason.trim(), "member");
            invalidate();
            notify("Request sent to the owner");
            setShowNew(false);
            setReason("");
          }}
        >
          <Textarea id="change-reason" label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button type="submit" fullWidth disabled={!reason.trim()}>Submit request</Button>
        </form>
      </Modal>
    </div>
  );
}
