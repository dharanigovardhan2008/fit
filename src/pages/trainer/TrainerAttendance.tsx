import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardTitle } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/States";
import { useToast } from "../../components/ui/Toast";
import { manualAttendanceCorrection, todayStr } from "../../lib/backend";
import { formatDate, formatTime } from "../../lib/format";
import type { Attendance } from "../../types";

export default function TrainerAttendance() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();
  const [editing, setEditing] = useState<Attendance | null>(null);

  const rows = useMemo(() => {
    if (!db || !session) return [];
    const myMemberIds = new Set(db.members.filter((m) => m.assignedTrainerId === session.userId).map((m) => m.userId));
    return db.attendance
      .filter((a) => myMemberIds.has(a.memberId))
      .sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate) || (b.checkIn ?? "").localeCompare(a.checkIn ?? ""))
      .slice(0, 60);
  }, [db, session]);

  async function saveCorrection(checkIn: string, checkOut: string) {
    if (!editing || !session) return;
    try {
      await manualAttendanceCorrection(session.gymId, session.userId, editing.attId, {
        checkIn: checkIn ? new Date(checkIn).toISOString() : null,
        checkOut: checkOut ? new Date(checkOut).toISOString() : null,
      });
      invalidate();
      notify("Attendance updated");
      setEditing(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : "We could not update this record.", "error");
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Attendance" description="Attendance history for members assigned to you, today first." />

      <Card>
        <CardTitle>Today, {formatDate(todayStr())}</CardTitle>
        {rows.length === 0 ? (
          <EmptyState title="No attendance yet" description="Attendance recorded by your members will appear here." />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[13px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="pb-2">Member</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Check-in</th>
                  <th className="pb-2">Check-out</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-track">
                {rows.map((a) => {
                  const member = db?.users.find((u) => u.userId === a.memberId);
                  return (
                    <tr key={a.attId}>
                      <td className="py-2.5">{member?.name}</td>
                      <td className="py-2.5 text-text-secondary">{formatDate(a.attendanceDate)}</td>
                      <td className="py-2.5">{formatTime(a.checkIn)}</td>
                      <td className="py-2.5">{formatTime(a.checkOut)}</td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          aria-label={`Correct attendance for ${member?.name ?? "member"}`}
                          className="rounded-full p-1.5 text-text-secondary hover:bg-black/5 hover:text-text-primary"
                          onClick={() => setEditing(a)}
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Correct attendance">
        {editing && <CorrectionForm attendance={editing} onCancel={() => setEditing(null)} onSave={saveCorrection} />}
      </Modal>
    </div>
  );
}

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CorrectionForm({
  attendance, onSave, onCancel,
}: { attendance: Attendance; onSave: (checkIn: string, checkOut: string) => void; onCancel: () => void }) {
  const [checkIn, setCheckIn] = useState(toLocalInput(attendance.checkIn));
  const [checkOut, setCheckOut] = useState(toLocalInput(attendance.checkOut));
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(checkIn, checkOut);
      }}
    >
      <Input id="tc-in" label="Check-in time" type="datetime-local" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
      <Input id="tc-out" label="Check-out time" type="datetime-local" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
      <p className="text-[11px] text-text-secondary">This correction is recorded in the audit log.</p>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" fullWidth onClick={onCancel}>Cancel</Button>
        <Button type="submit" fullWidth>Save</Button>
      </div>
    </form>
  );
}
