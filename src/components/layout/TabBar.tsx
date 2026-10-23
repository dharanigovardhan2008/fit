import { NavLink } from "react-router-dom";
import type { NavItem } from "../../lib/navigation";
import { cn } from "../../utils/cn";
import { useAuth } from "../../auth/AuthContext";
import { getAttendanceRequests, todayStr } from "../../lib/backend";
import { useDb } from "../../api/db";

function usePendingAttendanceCount(): number {
  const { session } = useAuth();
  const { data: db } = useDb();
  if (!session || !db) return 0;
  const today = todayStr();
  return getAttendanceRequests(session).filter(
    (r) => r.status === "pending" && r.requestedAt.slice(0, 10) === today,
  ).length;
}

export function TabBar({ items }: { items: NavItem[]; raisedTo?: string }) {
  const tabItems = items.filter((i) => i.tab);
  const pendingCount = usePendingAttendanceCount();

  return (
    <nav
      aria-label="Primary"
      className="no-print fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 mx-auto flex h-[60px] w-[min(327px,calc(100%-32px))] items-center justify-around rounded-[30px] bg-ink px-2 shadow-dock lg:hidden"
    >
      {tabItems.map((item) => {
        const count = item.badge === "attendance_requests" ? pendingCount : 0;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to.split("/").length <= 2}
            aria-label={item.label}
            className="flex h-11 w-11 items-center justify-center"
          >
            {({ isActive }) => (
              <span
                className={cn(
                  "relative flex items-center justify-center transition-all duration-200",
                  isActive
                    ? "-mt-9 h-14 w-14 rounded-full bg-ink text-on-ink shadow-dark-button ring-4 ring-bg"
                    : "h-11 w-11",
                )}
              >
                <item.icon size={isActive ? 24 : 22} className={cn("stroke-[1.5]", isActive ? "text-on-ink" : "text-on-ink/55")} />
                {count > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
