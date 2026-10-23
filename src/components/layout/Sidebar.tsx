import { NavLink } from "react-router-dom";
import { LogOut } from "lucide-react";
import type { NavItem } from "../../lib/navigation";
import { useAuth } from "../../auth/AuthContext";
import { initials } from "../../lib/format";
import { cn } from "../../utils/cn";
import { getAttendanceRequests, todayStr } from "../../lib/backend";
import { useDb } from "../../api/db";

function usePendingCount(): number {
  const { session } = useAuth();
  const { data: db } = useDb();
  if (!session || !db) return 0;
  const today = todayStr();
  return getAttendanceRequests(session).filter(
    (r) => r.status === "pending" && r.requestedAt.slice(0, 10) === today,
  ).length;
}

export function Sidebar({ items, gymName }: { items: NavItem[]; gymName: string }) {
  const { session, logout } = useAuth();
  const pendingCount = usePendingCount();

  return (
    <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-r border-black/5 bg-white/70 px-5 py-6 backdrop-blur lg:flex">
      <div className="mb-8 flex items-center gap-2 px-2">
        <img src="/logo-192.png" alt="Opsyl Fit" className="h-9 w-9 rounded-xl" />
        <div>
          <p className="text-[14px] font-semibold leading-5">Opsyl Fit</p>
          <p className="truncate text-[11px] text-text-secondary">{gymName}</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto no-scrollbar" aria-label="Main navigation">
        {items.filter((item) => !item.to.endsWith("/more")).map((item) => {
          const count = item.badge === "attendance_requests" ? pendingCount : 0;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to.split("/").length <= 2}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors duration-150",
                  isActive ? "bg-ink text-on-ink" : "text-text-secondary hover:bg-black/5 hover:text-text-primary",
                )
              }
            >
              <item.icon size={18} />
              <span className="flex-1">{item.label}</span>
              {count > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-4 flex items-center gap-3 rounded-xl bg-thumb px-3 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-on-ink">
          {initials(session?.name ?? "")}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{session?.name}</p>
          <p className="text-[11px] text-text-secondary">{session?.publicId}</p>
        </div>
        <button
          type="button"
          aria-label="Log out"
          onClick={logout}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-black/5 hover:text-text-primary"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
