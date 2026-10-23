import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardTitle } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Chip";
import { EmptyState } from "../../components/ui/States";
import { useToast } from "../../components/ui/Toast";
import { decideTrainerAttendance, setTrainerManualAttendance, todayStr } from "../../lib/backend";
import { formatDate, formatTime, initials } from "../../lib/format";

function toTimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toIso(date: string, time: string): string | null {
  return time ? new Date(`${date}T${time}:00`).toISOString() : null;
}

const tone = { pending: "warning", approved: "success", rejected: "danger", expired: "ink" } as const;

// Owner: approve trainers' own check-ins, and mark or correct a trainer's day by hand.
export default function OwnerTrainerAttendance() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();
  const [date, setDate] = useState(todayStr());
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState<{ trainerId: string; name: string } | null>(null);
  const [inTime, setInTime] = useState("");
  const [outTime, setOutTime] = useState("");
  const [busy, setBusy] = useState(false);

  const nameOf = (id: string) => db?.users.find((u) => u.userId === id)?.name ?? "Trainer";

  const pending = useMemo(
    () => (db?.trainerAttendance ?? []).filter((a) => a.status === "pending").sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate)),
    [db],
  );

  const trainers = useMemo(
    () =>
      (db?.trainers ?? [])
        .map((t) => ({ trainer: t, user: db?.users.find((u) => u.userId === t.userId) }))
        .filter((r) => r.user?.isActive)
        .map((r) => ({
          ...r,
          record: db?.trainerAttendance.find((a) => a.trainerId === r.trainer.userId && a.attendanceDate === date),
        }))
        .sort((a, b) => a.user!.name.localeCompare(b.user!.name)),
    [db, date],
  );

  async function decide(id: string, decision: "approved" | "rejected", why?: string) {
    setBusy(true);
    try {
      const result = await decideTrainerAttendance(id, decision, why);
      notify(result.message, result.ok ? "success" : "error");
      invalidate();
      setRejecting(null);
      setReason("");
    } finally {
      setBusy(false);
    }
  }

  async function saveManual() {
    if (!editing || !session) return;
    setBusy(true);
    try {
      await setTrainerManualAttendance(session.gymId, editing.trainerId, session.userId, date, toIso(date, inTime), toIso(date, outTime));
      notify("Attendance saved");
      invalidate();
      setEditing(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : "We could not save attendance.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Trainer attendance" description="Approve trainers' check-ins or mark their days yourself." />

      <Card>
        <CardTitle>Waiting for approval</CardTitle>
        {pending.length === 0 ? (
          <EmptyState title="Nothing waiting" description="When a trainer checks in, the request appears here." />
        ) : (
          <div className="mt-3 divide-y divide-track">
            {pending.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">{nameOf(a.trainerId)}</p>
                  <p className="text-[11px] text-text-secondary">
                    {formatDate(a.attendanceDate)} - in {formatTime(a.checkIn)}
                    {a.checkOut ? `, out ${formatTime(a.checkOut)}` : ""}
                    {a.distanceM != null ? ` - ${Math.round(a.distanceM)} m from the gym` : ""}
                  </p>
                </div>
                <Button size="sm" loading={busy} onClick={() => decide(a.id, "approved")}>Approve</Button>
                <Button size="sm" variant="secondary" onClick={() => setRejecting(a.id)}>Reject</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="sm:w-56">
        <Input id="ta-date" label="Date" type="date" max={todayStr()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </div>

      {trainers.length === 0 ? (
        <EmptyState title="No trainers yet" description="Add a trainer to mark their attendance." />
      ) : (
        <Card className="divide-y divide-track p-0">
          {trainers.map(({ trainer, user, record }) => (
            <div key={trainer.userId} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-thumb text-[11px] font-semibold">
                {initials(user!.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{user!.name}</p>
                <p className="text-[11px] text-text-secondary">
                  {user!.publicId}
                  {record?.checkIn ? ` - in ${formatTime(record.checkIn)}${record.checkOut ? `, out ${formatTime(record.checkOut)}` : ""}` : ""}
                </p>
              </div>
              <Badge tone={record ? tone[record.status] : "warning"}>{record ? record.status : "Not marked"}</Badge>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setEditing({ trainerId: trainer.userId, name: user!.name });
                  setInTime(toTimeInput(record?.checkIn ?? null) || (date === todayStr() ? toTimeInput(new Date().toISOString()) : "09:00"));
                  setOutTime(toTimeInput(record?.checkOut ?? null));
                }}
              >
                {record ? "Edit times" : "Set times"}
              </Button>
            </div>
          ))}
        </Card>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.name ?? "Attendance"}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); saveManual(); }}>
          <Input id="ta-in" label="Check-in time" type="time" required value={inTime} onChange={(e) => setInTime(e.target.value)} />
          <Input id="ta-out" label="Check-out time (optional)" type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} />
          <Button type="submit" fullWidth loading={busy}>Save attendance</Button>
        </form>
      </Modal>

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Reject attendance">
        <div className="flex flex-col gap-4">
          <Input id="ta-reason" label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button variant="danger" fullWidth loading={busy} onClick={() => rejecting && decide(rejecting, "rejected", reason)}>
            Reject
          </Button>
        </div>
      </Modal>
    </div>
  );
}
