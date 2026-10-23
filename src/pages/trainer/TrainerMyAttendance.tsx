import { useState } from "react";
import { MapPin } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Chip";
import { EmptyState } from "../../components/ui/States";
import { useToast } from "../../components/ui/Toast";
import { getMyTrainerAttendance, todayStr, trainerCheckIn, trainerCheckOut } from "../../lib/backend";
import { formatDate, formatTime } from "../../lib/format";

interface Position {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
}

// Reads the phone's location. If it is not available the request still goes to the owner, who decides.
function getPosition(): Promise<Position> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ lat: null, lng: null, accuracy: null });
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve({ lat: null, lng: null, accuracy: null }),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

const tone = { pending: "warning", approved: "success", rejected: "danger", expired: "ink" } as const;

// A trainer marks their own attendance. The owner approves it.
export default function TrainerMyAttendance() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);

  if (!session) return null;
  // db is read so this page re-renders whenever the data refreshes
  const rows = db ? getMyTrainerAttendance(session) : [];
  const today = rows.find((r) => r.attendanceDate === todayStr());
  const canCheckIn = !today;
  const canCheckOut = !!today && !!today.checkIn && !today.checkOut && today.status !== "rejected";

  async function run(action: () => Promise<{ ok: boolean; message: string }>) {
    setBusy(true);
    try {
      const result = await action();
      notify(result.message, result.ok ? "success" : "error");
      invalidate();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="My attendance" description="Mark your own days. The gym owner approves them." />

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <CardTitle>Today, {formatDate(todayStr())}</CardTitle>
          {today && <Badge tone={tone[today.status]}>{today.status === "pending" ? "Waiting for approval" : today.status}</Badge>}
        </div>
        {today ? (
          <p className="text-[13px] text-text-secondary">
            In {formatTime(today.checkIn)}{today.checkOut ? `, out ${formatTime(today.checkOut)}` : ""}
            {today.status === "rejected" && today.rejectReason ? `. Reason: ${today.rejectReason}` : ""}
          </p>
        ) : (
          <p className="text-[13px] text-text-secondary">You have not checked in today.</p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          {canCheckIn && (
            <Button
              fullWidth
              loading={busy}
              onClick={() => run(async () => {
                const pos = await getPosition();
                return trainerCheckIn(pos.lat, pos.lng, pos.accuracy);
              })}
            >
              <MapPin size={16} /> Check in
            </Button>
          )}
          {canCheckOut && (
            <Button fullWidth variant="secondary" loading={busy} onClick={() => run(trainerCheckOut)}>
              Check out
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>History</CardTitle>
        {rows.length === 0 ? (
          <EmptyState title="No attendance yet" description="Your check-ins will be listed here." />
        ) : (
          <div className="mt-3 divide-y divide-track">
            {rows.slice(0, 30).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                <span>{formatDate(r.attendanceDate)}</span>
                <span className="text-text-secondary">
                  {formatTime(r.checkIn)} - {formatTime(r.checkOut)}
                </span>
                <Badge tone={tone[r.status]}>{r.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
