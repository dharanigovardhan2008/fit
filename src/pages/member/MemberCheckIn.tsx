import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { MapPin, ScanLine, Video, VideoOff, Wifi } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { todayStr } from "../../lib/backend";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import {
  attendanceScan, getMemberTodayRequest, refreshDb,
  gpsOnlyRequest, type ScanResult,
} from "../../lib/backend";
import { useToast } from "../../components/ui/Toast";
import type { AttendanceRequest } from "../../types";

type ScanState = "idle" | "camera-on" | "processing" | "result";

// Polls Supabase for status changes every 3 seconds.
function useRequestStatus(requestId: string | null, gymId: string | null) {
  const [status, setStatus] = useState<AttendanceRequest | null>(null);
  useEffect(() => {
    if (!requestId || !gymId) return;
    const check = async () => {
      try {
        const db = await refreshDb();
        const req = db.attendanceRequests.find((r: AttendanceRequest) => r.requestId === requestId);
        if (req) setStatus({ ...req });
      } catch {
        /* keep the last known status */
      }
    };
    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, [requestId, gymId]);
  return status;
}

export default function MemberCheckIn() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [state, setState] = useState<ScanState>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  // Track the pending request ID for live status polling
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const liveStatus = useRequestStatus(pendingRequestId, session?.gymId ?? null);

  // When the live status changes, update UI
  useEffect(() => {
    if (!liveStatus || liveStatus.status === "pending") return;
    invalidate();
    if (liveStatus.status === "approved") {
      setResult({ ok: true, message: "You are marked present.", status: "approved" });
    } else if (liveStatus.status === "rejected") {
      const reason = liveStatus.rejectReason;
      setResult({
        ok: false,
        message: reason ? `Request not approved: ${reason}` : "Your request was not approved.",
        status: "rejected",
      });
      setPendingRequestId(null);
    } else if (liveStatus.status === "expired") {
      setResult({ ok: false, message: "Your request expired without a decision. You can request again.", status: "expired" });
      setPendingRequestId(null);
    }
  }, [liveStatus, invalidate]);

  useEffect(() => () => stopCamera(), []);

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startCamera() {
    setCameraError(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState("camera-on");
      tick();
    } catch {
      setCameraError("Camera access was not granted. Use the demo code button or GPS request below.");
    }
  }

  function tick() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) { rafRef.current = requestAnimationFrame(tick); return; }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code?.data) {
      stopCamera();
      setState("processing");
      processToken(code.data);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  async function processToken(token: string) {
    if (!session) return;
    setLocationNote("Getting your location...");
    if (!navigator.geolocation) {
      setLocationNote(null);
      const outcome = await attendanceScan(session, token, null, null, null);
      finish(outcome);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLocationNote(null);
        const outcome = await attendanceScan(session, token, pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        finish(outcome);
      },
      async () => {
        setLocationNote(null);
        const outcome = await attendanceScan(session, token, null, null, null);
        finish(outcome);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function finish(outcome: ScanResult) {
    setResult(outcome);
    setState("result");
    if (outcome.status === "pending" && outcome.requestId) {
      setPendingRequestId(outcome.requestId);
      notify("Request sent — waiting for approval", "success");
    } else if (outcome.ok) {
      setPendingRequestId(null);
      invalidate();
      notify(outcome.message, "success");
    } else {
      setPendingRequestId(null);
      invalidate();
      notify(outcome.message, "error");
    }
  }

  async function requestGpsOnly() {
    if (!session) return;
    setState("processing");
    setLocationNote("Getting your location...");
    if (!navigator.geolocation) {
      setLocationNote(null);
      const outcome = await gpsOnlyRequest(session, 0, 0, 999);
      finish(outcome);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLocationNote(null);
        const outcome = await gpsOnlyRequest(session, pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        finish(outcome);
      },
      async () => {
        setLocationNote(null);
        const outcome = await gpsOnlyRequest(session, 0, 0, 999);
        finish(outcome);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function resetForRetry() {
    setResult(null);
    setState("idle");
    setPendingRequestId(null);
  }

  const todayRow = db?.attendance.find((a) => a.memberId === session?.userId && a.attendanceDate === todayStr());
  const isPresent = !!(todayRow?.checkIn);
  const isPending = result?.status === "pending" && !!pendingRequestId;
  const canRetry = result && !result.ok && result.status !== "pending";

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Check-in / Check-out" description="Scan the QR code at the entrance or request via GPS." />

      <Card className="flex flex-col items-center gap-4 overflow-hidden">
        <div className="relative flex h-72 w-full max-w-sm items-center justify-center overflow-hidden rounded-[22px] bg-ink-deep">
          <video ref={videoRef} className={`h-full w-full object-cover ${state === "camera-on" ? "block" : "hidden"}`} muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
          {state !== "camera-on" && (
            <div className="flex flex-col items-center gap-2 text-white/70">
              {isPending ? (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 animate-pulse">
                    <Wifi size={24} className="text-white/80" />
                  </div>
                  <p className="px-6 text-center text-[13px] font-medium text-white">Waiting for approval</p>
                  <p className="px-6 text-center text-[11px] text-white/50">The page updates automatically when a decision is made.</p>
                </>
              ) : (
                <>
                  <ScanLine size={32} />
                  <p className="px-6 text-center text-[12px]">Point your camera at the check-in or check-out QR code at the entrance.</p>
                </>
              )}
            </div>
          )}
          {state === "camera-on" && (
            <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/70" aria-hidden="true" />
          )}
        </div>

        {cameraError && <p className="text-center text-[12px] text-danger">{cameraError}</p>}
        {locationNote && (
          <p className="flex items-center gap-1.5 text-[12px] text-text-secondary"><MapPin size={14} /> {locationNote}</p>
        )}

        {result && (
          <div className={`w-full rounded-2xl px-4 py-3 text-center text-[13px] ${
            result.status === "pending"
              ? "bg-amber-50 text-amber-700 border border-amber-200"
              : result.ok
              ? "bg-success/10 text-success"
              : "bg-danger/10 text-danger"
          }`}>
            {result.message}
          </div>
        )}

        <div className="flex w-full flex-col gap-2 sm:flex-row">
          {state === "camera-on" ? (
            <Button variant="secondary" fullWidth onClick={() => { stopCamera(); setState("idle"); }}>
              <VideoOff size={16} /> Stop camera
            </Button>
          ) : (
            !isPending && !isPresent && (
              <Button fullWidth onClick={startCamera} loading={state === "processing"}>
                <Video size={16} /> Start camera
              </Button>
            )
          )}
        </div>

        {/* GPS-only request — for members who cannot scan */}
        {!isPending && !isPresent && (
          <Button variant="ghost" fullWidth onClick={requestGpsOnly} disabled={state === "processing"} className="text-[12px]">
            <MapPin size={14} /> Request via GPS only (no QR)
          </Button>
        )}

        {canRetry && (
          <Button variant="secondary" fullWidth onClick={resetForRetry}>
            Try again
          </Button>
        )}
      </Card>

      <Card>
        <CardTitle>How this works</CardTitle>
        <ul className="mt-3 flex flex-col gap-2 text-[12px] leading-5 text-text-secondary">
          <li>Scan the check-in QR at the entrance. Your trainer or the owner will approve your request.</li>
          <li>You will see "Present" once approved. If rejected, the reason is shown and you can try again.</li>
          <li>Up to 3 requests are allowed per day.</li>
          <li>Check-out is recorded directly after approval, without a second approval step.</li>
          <li>If you cannot scan, use "Request via GPS only" — approvers see a "No QR" tag.</li>
        </ul>
      </Card>
    </div>
  );
}
