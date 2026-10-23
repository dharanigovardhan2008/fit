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
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser cannot open the camera here. Use \"Scan from a photo\" below.");
      return;
    }
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch (first) {
        // Some phones and laptops reject the back-camera hint. Try any camera.
        if (first instanceof DOMException && first.name === "NotAllowedError") throw first;
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.setAttribute("playsinline", "true");
        video.muted = true;
        video.srcObject = stream;
        await video.play();
      }
      setState("camera-on");
      tick();
    } catch (err) {
      stopCamera();
      const name = err instanceof DOMException ? err.name : "";
      setCameraError(
        name === "NotAllowedError"
          ? "Camera is blocked. Tap the lock icon in the address bar, allow Camera, then press Start camera again. Or use \"Scan from a photo\"."
          : name === "NotFoundError"
          ? "No camera was found on this device. Use \"Scan from a photo\" instead."
          : name === "NotReadableError"
          ? "The camera is being used by another app. Close it and try again."
          : "The camera could not start. Use \"Scan from a photo\" instead.",
      );
    }
  }

  // Fallback for phones where the live camera is blocked: take or pick a photo of the QR.
  function scanPhoto(file: File | undefined) {
    if (!file) return;
    setCameraError(null);
    setResult(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      URL.revokeObjectURL(url);
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(data.data, data.width, data.height, { inversionAttempts: "attemptBoth" });
      if (code?.data) {
        setState("processing");
        void processToken(code.data);
      } else {
        setCameraError("No QR code found in that photo. Move closer and try again.");
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setCameraError("That photo could not be read.");
    };
    img.src = url;
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
        <div className="relative flex aspect-square max-h-80 w-full max-w-sm items-center justify-center overflow-hidden rounded-[22px] bg-ink-deep">
          <video ref={videoRef} className={state === "camera-on" ? "h-full w-full object-cover" : "pointer-events-none absolute h-px w-px opacity-0"} muted playsInline autoPlay />
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
            !isPending && (
              <Button fullWidth onClick={startCamera} loading={state === "processing"}>
                <Video size={16} /> {isPresent ? "Scan to check out" : "Start camera"}
              </Button>
            )
          )}
        </div>

        {isPresent && !result && (
          <p className="w-full rounded-2xl bg-success/10 px-4 py-3 text-center text-[13px] text-success">You are marked present today.</p>
        )}

        {/* GPS-only request — for members who cannot scan */}
        {!isPending && !isPresent && (
          <Button variant="ghost" fullWidth onClick={requestGpsOnly} disabled={state === "processing"} className="text-[12px]">
            <MapPin size={14} /> Request via GPS only (no QR)
          </Button>
        )}

        {!isPending && state !== "camera-on" && (
          <label className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-track bg-white text-[13px] font-medium text-text-primary hover:border-ink/20">
            <ScanLine size={16} /> Scan from a photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                scanPhoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
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
