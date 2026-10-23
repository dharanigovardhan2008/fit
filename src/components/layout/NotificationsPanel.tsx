import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { markAllNotificationsRead, markNotificationRead } from "../../lib/backend";
import { formatDateTime } from "../../lib/format";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/States";
import { disablePush, enablePush, getPushState, type PushState } from "../../lib/push";
import { useToast } from "../ui/Toast";

function DeviceAlerts({ userId }: { userId: string }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const { notify } = useToast();
  useEffect(() => { getPushState().then(setState); }, []);
  if (!state || state === "unsupported") return null;

  const hint =
    state === "needs-install" ? "On iPhone, tap Share, then Add to Home Screen, and open the app from there."
    : state === "blocked" ? "Notifications are blocked. Allow them in your browser settings."
    : state === "on" ? "Alerts will pop up on this device."
    : "Get alerts on this device even when the app is closed.";

  async function toggle() {
    setBusy(true);
    try {
      if (state === "on") await disablePush();
      else await enablePush(userId);
      setState(await getPushState());
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not change notifications.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 flex items-center gap-3 rounded-2xl bg-thumb px-4 py-3">
      <BellRing size={18} className="shrink-0 text-text-primary" aria-hidden="true" />
      <p className="flex-1 text-[12px] leading-4 text-text-secondary">{hint}</p>
      {(state === "on" || state === "off") && (
        <Button size="sm" variant={state === "on" ? "secondary" : "primary"} onClick={toggle} loading={busy}>
          {state === "on" ? "Turn off" : "Turn on"}
        </Button>
      )}
    </div>
  );
}

export function NotificationsPanel() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();

  const notifications = (db?.notifications ?? [])
    .filter((n) => n.userId === session?.userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <>
      <button
        type="button"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        onClick={() => setOpen(true)}
        className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card"
      >
        <Bell size={18} className="text-text-primary" />
        {unread > 0 && (
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-danger" aria-hidden="true" />
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Notifications">
        {session && <DeviceAlerts userId={session.userId} />}
        {notifications.length === 0 ? (
          <EmptyState title="You are all caught up" description="New updates about members, trainers and your gym will appear here." />
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (session) await markAllNotificationsRead(session.userId);
                  invalidate();
                }}
              >
                Mark all read
              </Button>
            </div>
            <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`rounded-2xl border px-4 py-3 ${n.isRead ? "border-transparent bg-thumb" : "border-ink/10 bg-white"}`}
                >
                  <button
                    type="button"
                    className="block w-full text-left"
                    onClick={async () => {
                      await markNotificationRead(n.id);
                      invalidate();
                    }}
                  >
                    <p className="text-[13px] leading-5 text-text-primary">{n.message}</p>
                    <p className="mt-1 text-[11px] text-text-secondary">{formatDateTime(n.createdAt)}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </>
  );
}
