import { useState } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { markAllNotificationsRead, markNotificationRead } from "../../lib/backend";
import { formatDateTime } from "../../lib/format";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/States";

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
