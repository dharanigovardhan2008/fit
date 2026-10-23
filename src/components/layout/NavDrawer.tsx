import { NavLink } from "react-router-dom";
import { LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { NavItem } from "../../lib/navigation";
import { useAuth } from "../../auth/AuthContext";

export function NavDrawer({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const { session, logout } = useAuth();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card"
      >
        <Menu size={18} className="text-text-primary" />
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="drawer-in absolute inset-y-0 left-0 flex w-[84%] max-w-[320px] flex-col overflow-y-auto bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-dock">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-semibold text-text-primary">Menu</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-thumb text-text-secondary">
                <X size={18} />
              </button>
            </div>
            <div className="mb-4 rounded-2xl bg-thumb px-4 py-3">
          <p className="text-[13px] font-medium text-text-primary">{session?.name}</p>
          <p className="text-[11px] text-text-secondary">{session?.publicId}</p>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Menu">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to.split("/").length <= 2}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium ${isActive ? "bg-ink text-on-ink" : "text-text-secondary hover:bg-black/5 hover:text-text-primary"}`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={logout}
            className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-danger hover:bg-danger/5"
          >
            <LogOut size={18} />
            Log out
          </button>
        </nav>
                </aside>
        </div>,
        document.body,
      )}
    </>
  );
}
