import { useMemo, useState } from "react";
import { CheckCircle, XCircle, CheckCheck, Clock, MapPin } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Chip";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { EmptyState } from "../../components/ui/States";
import { useToast } from "../../components/ui/Toast";
import {
  getAttendanceRequests, decideAttendanceRequest, approveAllAttendanceRequests, todayStr,
} from "../../lib/backend";
import { formatTime } from "../../lib/format";
import type { AttendanceRequest } from "../../types";

export default function TrainerPendingRequests() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();

  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AttendanceRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveAllLoading, setApproveAllLoading] = useState(false);
  const [confirmApproveAll, setConfirmApproveAll] = useState(false);

  const today = todayStr();

  const pending = useMemo(() => {
    if (!session || !db) return [];
    // Trainer sees only their own members' requests
    return getAttendanceRequests(session)
      .filter((r) => r.status === "pending" && r.requestedAt.slice(0, 10) === today)
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  }, [session, db, today]);

  async function approve(req: AttendanceRequest) {
    if (!session) return;
    setDecidingId(req.requestId);
    try {
      const res = await decideAttendanceRequest(session, req.requestId, "approved");
      if (res.ok) {
        invalidate();
        notify("Approved — member is now marked present");
      } else {
        notify(res.message, "error");
      }
    } finally {
      setDecidingId(null);
    }
  }

  async function submitReject() {
    if (!session || !rejectTarget) return;
    setDecidingId(rejectTarget.requestId);
    try {
      const res = await decideAttendanceRequest(session, rejectTarget.requestId, "rejected", rejectReason || undefined);
      if (res.ok) {
        invalidate();
        notify("Request rejected");
        setRejectTarget(null);
        setRejectReason("");
      } else {
        notify(res.message, "error");
      }
    } finally {
      setDecidingId(null);
    }
  }

  async function approveAll() {
    if (!session) return;
    setApproveAllLoading(true);
    setConfirmApproveAll(false);
    try {
      const res = await approveAllAttendanceRequests(session);
      invalidate();
      notify(`${res.approved} member${res.approved !== 1 ? "s" : ""} approved`);
    } finally {
      setApproveAllLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader
        title="Pending Requests"
        description="Attendance requests from your members awaiting your approval."
        action={
          pending.length > 0 ? (
            <Button size="sm" onClick={() => setConfirmApproveAll(true)} loading={approveAllLoading}>
              <CheckCheck size={14} /> Approve all ({pending.length})
            </Button>
          ) : undefined
        }
      />

      {pending.length === 0 ? (
        <EmptyState
          title="No pending requests"
          description="Attendance requests from your members will appear here."
        />
      ) : (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <CardTitle>Today, {today}</CardTitle>
            <Badge tone="ink">{pending.length} pending</Badge>
          </div>
          <div className="flex flex-col gap-3">
            {pending.map((req) => {
              const member = db?.users.find((u) => u.userId === req.memberId);
              const memberName = member?.name ?? "Member";
              return (
                <div
                  key={req.requestId}
                  className="flex flex-col gap-3 rounded-2xl border border-track bg-white p-4 shadow-sm sm:flex-row sm:items-center"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-on-ink">
                    {memberName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <p className="truncate text-[14px] font-medium text-text-primary">{memberName}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[12px] text-text-secondary">
                      <span className="flex items-center gap-1"><Clock size={12} />{formatTime(req.requestedAt)}</span>
                      {req.distanceM != null && (
                        <span className="flex items-center gap-1"><MapPin size={12} />{Math.round(req.distanceM)} m</span>
                      )}
                      {req.method === "gps_only" && <Badge tone="warn">No QR</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approve(req)} loading={decidingId === req.requestId} disabled={decidingId === req.requestId}>
                      <CheckCircle size={14} /> Present
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => { setRejectTarget(req); setRejectReason(""); }} disabled={decidingId === req.requestId}>
                      <XCircle size={14} /> Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Reject request">
        {rejectTarget && (
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); submitReject(); }}>
            <p className="text-[13px] text-text-secondary">
              Rejecting request from{" "}
              <span className="font-medium text-text-primary">
                {db?.users.find((u) => u.userId === rejectTarget.memberId)?.name ?? "member"}
              </span>.
            </p>
            <Input
              id="trainerRejectReason"
              label="Reason (optional)"
              placeholder="e.g. Not within gym radius"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" fullWidth onClick={() => setRejectTarget(null)}>Cancel</Button>
              <Button type="submit" variant="danger" fullWidth loading={decidingId === rejectTarget.requestId}>Reject</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={confirmApproveAll} onClose={() => setConfirmApproveAll(false)} title="Approve all requests">
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-text-secondary">
            This will approve all {pending.length} pending request{pending.length !== 1 ? "s" : ""} from your members.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setConfirmApproveAll(false)}>Cancel</Button>
            <Button fullWidth onClick={approveAll} loading={approveAllLoading}>Approve all</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

