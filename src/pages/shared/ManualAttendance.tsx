import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Chip";
import { SearchField } from "../../components/ui/SearchField";
import { EmptyState } from "../../components/ui/States";
import { useToast } from "../../components/ui/Toast";
import { setManualAttendance, todayStr } from "../../lib/backend";
import { formatTime, initials } from "../../lib/format";

// Local time (HH:MM) of an ISO timestamp, for the time inputs.
function toTimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Combines the chosen date and a time of day (both in the person's local time) into an ISO timestamp.
function toIso(date: string, time: string): string | null {
  if (!time) return null;
  return new Date(`${date}T${time}:00`).toISOString();
}

// Manual attendance for the owner (every member) and trainers (their own members).
export default function ManualAttendance() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();
  const [date, setDate] = useState(todayStr());
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ memberId: string; name: string } | null>(null);
  const [inTime, setInTime] = useState("");
  const [outTime, setOutTime] = useState("");
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    if (!db || !session) return [];
    const q = search.trim().toLowerCase();
    return db.members
      .filter((m) => session.role === "owner" || m.assignedTrainerId === session.userId)
      .map((m) => {
        const user = db.users.find((u) => u.userId === m.userId);
        const record = db.attendance.find((a) => a.memberId === m.userId && a.attendanceDate === date);
        return { member: m, user, record };
      })
      .filter((r) => r.user && r.user.isActive)
      .filter((r) => !q || r.user!.name.toLowerCase().includes(q) || r.user!.publicId.toLowerCase().includes(q))
      .sort((a, b) => a.user!.name.localeCompare(b.user!.name));
  }, [db, session, search, date]);

  function openEditor(memberId: string, name: string, checkIn: string | null, checkOut: string | null) {
    setEditing({ memberId, name });
    setInTime(toTimeInput(checkIn) || (date === todayStr() ? toTimeInput(new Date().toISOString()) : "09:00"));
    setOutTime(toTimeInput(checkOut));
  }

  async function save(memberId: string, checkIn: string | null, checkOut: string | null) {
    if (!session) return;
    setSaving(true);
    try {
      await setManualAttendance(session.gymId, memberId, session.userId, date, checkIn, checkOut);
      invalidate();
      notify("Attendance saved");
      setEditing(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : "We could not save attendance.", "error");
    } finally {
      setSaving(false);
    }
  }

  const isToday = date === todayStr();

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader
        title="Manual attendance"
        description={session?.role === "owner" ? "Mark attendance for any member." : "Mark attendance for your members."}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-56">
          <Input id="ma-date" label="Date" type="date" max={todayStr()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
        <SearchField className="flex-1" placeholder="Search members by name or ID" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No members found" description="Members you can mark attendance for will appear here." />
      ) : (
        <Card className="divide-y divide-track p-0">
          {rows.map(({ member, user, record }) => {
            const present = !!record?.checkIn;
            const inside = present && !record?.checkOut;
            return (
              <div key={member.userId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-thumb text-[11px] font-semibold">
                  {initials(user!.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{user!.name}</p>
                  <p className="text-[11px] text-text-secondary">
                    {user!.publicId}
                    {present && ` - in ${formatTime(record!.checkIn)}${record!.checkOut ? `, out ${formatTime(record!.checkOut)}` : ""}`}
                  </p>
                </div>
                <Badge tone={!present ? "warning" : inside ? "success" : "ink"}>
                  {!present ? "Not marked" : inside ? "Inside" : "Done"}
                </Badge>
                <div className="flex gap-2">
                  {!present && isToday && (
                    <Button size="sm" onClick={() => save(member.userId, new Date().toISOString(), null)}>
                      Present now
                    </Button>
                  )}
                  {inside && isToday && (
                    <Button size="sm" variant="secondary" onClick={() => save(member.userId, record!.checkIn, new Date().toISOString())}>
                      Check out now
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openEditor(member.userId, user!.name, record?.checkIn ?? null, record?.checkOut ?? null)}
                  >
                    {present ? "Edit times" : "Set times"}
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `${editing.name}` : "Attendance"}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editing) return;
            save(editing.memberId, toIso(date, inTime), toIso(date, outTime));
          }}
        >
          <Input id="ma-in" label="Check-in time" type="time" required value={inTime} onChange={(e) => setInTime(e.target.value)} />
          <Input id="ma-out" label="Check-out time (optional)" type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} />
          <Button type="submit" fullWidth loading={saving}>Save attendance</Button>
        </form>
      </Modal>
    </div>
  );
}
