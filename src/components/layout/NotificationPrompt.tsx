import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { enablePush, getPushState, type PushState } from "../../lib/push";

const KEY = "opsyl.pushPromptUntil";

function snoozed(): boolean {
  try { return Number(localStorage.getItem(KEY) ?? 0) > Date.now(); } catch { return false; }
}
function snooze(days: number) {
  try { localStorage.setItem(KEY, String(Date.now() + days * 86400000)); } catch { /* ignore */ }
}

// Asks once after login to turn on device alerts. "Later" hides it for 3 days.
export function NotificationPrompt() {
  const { session } = useAuth();
  const { notify } = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [hidden, setHidden] = useState(snoozed);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getPushState().then(setState); }, []);

  if (!session || hidden || state !== "off") return null;

  async function turnOn() {
    if (!session) return;
    setBusy(true);
    try {
      await enablePush(session.userId);
      notify("Device alerts are on");
      setHidden(true);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not turn on notifications.", "error");
    } finally {
      setBusy(false);
    }
  }

  function later() {
    snooze(3);
    setHidden(true);
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(max(1.25rem,env(safe-area-inset-bottom))+84px)] z-40 mx-auto w-[min(420px,calc(100%-32px))] animate-fade-in rounded-[22px] bg-white p-4 shadow-dock lg:bottom-6 lg:left-auto lg:right-6 lg:mx-0">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-on-ink">
          <BellRing size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-text-primary">Turn on alerts</p>
          <p className="mt-0.5 text-[12px] leading-4 text-text-secondary">
            Get approvals, reminders and gym updates right on this device, even when the app is closed.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={turnOn} loading={busy}>Turn on</Button>
            <Button size="sm" variant="ghost" onClick={later}>Later</Button>
          </div>
        </div>
        <button type="button" aria-label="Close" onClick={later} className="text-text-secondary">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
