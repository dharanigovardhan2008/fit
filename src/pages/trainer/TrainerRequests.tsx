import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Chip";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Input, Textarea } from "../../components/ui/Input";
import { EmptyState } from "../../components/ui/States";
import { useToast } from "../../components/ui/Toast";
import { submitNewMemberForApproval } from "../../lib/backend";
import { formatDateTime } from "../../lib/format";

export default function TrainerRequests() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();
  const [showSuggest, setShowSuggest] = useState(false);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");

  const myRequests = useMemo(() => {
    if (!db || !session) return [];
    return db.changeRequests
      .filter((r) => r.toTrainer === session.userId || r.fromTrainer === session.userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [db, session]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader
        title="Requests"
        description="Change-trainer requests involving you and members you have suggested."
        action={<Button onClick={() => setShowSuggest(true)}><Plus size={16} /> Suggest a member</Button>}
      />

      {myRequests.length === 0 ? (
        <EmptyState title="No requests yet" description="Requests involving your members will appear here." />
      ) : (
        <div className="grid gap-3">
          {myRequests.map((r) => (
            <Card key={r.reqId} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Badge tone="neutral">{r.submittedBy === "trainer" ? "Suggestion" : "Change request"}</Badge>
                <Badge tone={r.status === "pending" ? "warning" : r.status === "approved" ? "success" : "danger"}>{r.status}</Badge>
              </div>
              <p className="text-[13px] text-text-primary">{r.reason}</p>
              <p className="text-[11px] text-text-secondary">{formatDateTime(r.createdAt)}</p>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showSuggest} onClose={() => setShowSuggest(false)} title="Suggest a new member">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!session || !name.trim()) return;
            await submitNewMemberForApproval(session.gymId, session.userId, name.trim(), reason);
            invalidate();
            notify("Suggestion sent to the owner");
            setShowSuggest(false);
            setName("");
            setReason("");
          }}
        >
          <Input id="sm-name" label="Prospective member name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea id="sm-reason" label="Notes for the owner" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button type="submit" fullWidth>Send for approval</Button>
        </form>
      </Modal>
    </div>
  );
}
