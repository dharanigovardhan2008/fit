import { useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Printer, RefreshCcw, Pencil } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Chip";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { getAttendanceQr, manualAttendanceCorrection, todayStr } from "../../lib/backend";
import { useToast } from "../../components/ui/Toast";
import { formatTime } from "../../lib/format";
import type { Attendance } from "../../types";

function QrPrintSheet({ gymName, label, date, value }: { gymName: string; label: string; date: string; value: string }) {
  return (
    <div className="flex h-[100vh] w-full flex-col items-center justify-center gap-6 bg-white p-10 text-center">
      <p className="text-[22px] font-semibold">{gymName}</p>
      <p className="text-[14px] text-text-secondary">{label} QR code - {date}</p>
      <QRCodeCanvas value={value} size={320} level="M" />
      <p className="text-[12px] text-text-secondary">Scan with the GymSphere app to {label.toLowerCase()}.</p>
    </div>
  );
}

function QrCard({
  label, value, gymName, date, onDownload,
}: { label: string; value: string; gymName: string; date: string; onDownload: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: `${gymName} - ${label} QR` });

  return (
    <Card className="flex flex-1 flex-col items-center gap-4 text-center">
      <CardTitle>{label} QR</CardTitle>
      <div className="rounded-2xl border border-track p-4">
        <QRCodeCanvas value={value} size={168} level="M" />
      </div>
      <p className="text-[11px] text-text-secondary">Valid for today, {date}</p>
      <div className="flex w-full gap-2">
        <Button variant="secondary" size="sm" fullWidth onClick={() => handlePrint()}>
          <Printer size={14} /> Print
        </Button>
        <Button variant="secondary" size="sm" fullWidth onClick={onDownload}>
          <Download size={14} /> Download
        </Button>
      </div>
      <div className="hidden">
        <div ref={printRef}>
          <QrPrintSheet gymName={gymName} label={label} date={date} value={value} />
        </div>
      </div>
    </Card>
  );
}

export default function OwnerAttendance() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();
  const [tokens, setTokens] = useState<{ date: string; checkIn: string; checkOut: string } | null>(null);
  const [tabletMode, setTabletMode] = useState(false);
  const [editing, setEditing] = useState<Attendance | null>(null);

  const gym = db?.gyms.find((g) => g.gymId === session?.gymId);

  async function loadTokens() {
    if (!session) return;
    try {
      const result = await getAttendanceQr(session.gymId);
      setTokens(result);
    } catch (err) {
      notify(err instanceof Error ? err.message : "We could not generate the QR codes right now.", "error");
    }
  }

  useEffect(() => {
    loadTokens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.gymId]);

  useEffect(() => {
    if (!tabletMode) return;
    const interval = setInterval(loadTokens, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabletMode]);

  const today = todayStr();
  const todaysLog = (db?.attendance ?? [])
    .filter((a) => a.gymId === session?.gymId && a.attendanceDate === today)
    .sort((a, b) => (b.checkIn ?? "").localeCompare(a.checkIn ?? ""));
  const insideNow = todaysLog.filter((a) => a.checkIn && !a.checkOut).length;

  function downloadQr(label: string) {
    const canvas = document.querySelector<HTMLCanvasElement>(
      label === "Check-In" ? "#qr-checkin canvas" : "#qr-checkout canvas",
    );
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${label.toLowerCase().replace(" ", "-")}-${today}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

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
      <PageHeader
        title="Attendance"
        description="Print or display today's QR codes at the entrance."
        action={
          <Button variant="secondary" size="sm" onClick={() => setTabletMode((v) => !v)}>
            <RefreshCcw size={14} />
            {tabletMode ? "Tablet mode: on" : "Tablet mode: off"}
          </Button>
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row">
        <div id="qr-checkin" className="flex flex-1">
          {tokens && gym && <QrCard label="Check-In" value={tokens.checkIn} gymName={gym.name} date={tokens.date} onDownload={() => downloadQr("Check-In")} />}
        </div>
        <div id="qr-checkout" className="flex flex-1">
          {tokens && gym && <QrCard label="Check-Out" value={tokens.checkOut} gymName={gym.name} date={tokens.date} onDownload={() => downloadQr("Check-Out")} />}
        </div>
      </div>
      {tabletMode && (
        <p className="text-[12px] text-text-secondary">
          Tablet mode refreshes the code automatically every 60 seconds. A scan made in the last minute is still accepted.
        </p>
      )}

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>Inside the gym right now</CardTitle>
          <Badge tone="ink">{insideNow} inside</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-text-secondary">
                <th className="pb-2">Member</th>
                <th className="pb-2">Check-in</th>
                <th className="pb-2">Check-out</th>
                <th className="pb-2">Method</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-track">
              {todaysLog.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-text-secondary">No attendance recorded yet today.</td></tr>
              )}
              {todaysLog.map((a) => {
                const member = db?.users.find((u) => u.userId === a.memberId);
                return (
                  <tr key={a.attId}>
                    <td className="py-2.5">{member?.name ?? "Member"}</td>
                    <td className="py-2.5">{formatTime(a.checkIn)}</td>
                    <td className="py-2.5">{formatTime(a.checkOut)}</td>
                    <td className="py-2.5 capitalize">{(a.inMethod ?? "-").replace("_", " ")}</td>
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
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Correct attendance">
        {editing && (
          <CorrectionForm
            attendance={editing}
            onCancel={() => setEditing(null)}
            onSave={saveCorrection}
          />
        )}
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
      <Input id="checkInTime" label="Check-in time" type="datetime-local" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
      <Input id="checkOutTime" label="Check-out time" type="datetime-local" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
      <p className="text-[11px] text-text-secondary">This correction is recorded in the audit log with your name and the time of the change.</p>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" fullWidth onClick={onCancel}>Cancel</Button>
        <Button type="submit" fullWidth>Save</Button>
      </div>
    </form>
  );
}
