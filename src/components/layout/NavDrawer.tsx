import { NavLink } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import type { NavItem } from "../../lib/navigation";
import { useAuth } from "../../auth/AuthContext";
import { Modal } from "../ui/Modal";

export function NavDrawer({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const { session, logout } = useAuth();

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
      <Modal open={open} onClose={() => setOpen(false)} title="Menu" width="max-w-xs">
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
      </Modal>
    </>
  );
}
