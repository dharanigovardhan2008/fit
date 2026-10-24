import { Outlet } from "react-router-dom";
import type { NavItem } from "../../lib/navigation";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { NavDrawer } from "./NavDrawer";
import { NotificationsPanel } from "./NotificationsPanel";
import { GymSwitcher } from "./GymSwitcher";
import { NotificationPrompt } from "./NotificationPrompt";
import { PaymentReturnHandler } from "./PaymentReturnHandler";
import { useAuth } from "../../auth/AuthContext";
import { useDb } from "../../api/db";

export function AppShell({ items, raisedTo, greeting }: { items: NavItem[]; raisedTo?: string; greeting: string }) {
  const { session } = useAuth();
  const { data: db } = useDb();
  const gym = db?.gyms.find((g) => g.gymId === session?.gymId);

  return (
    <div className="flex min-h-screen w-full overflow-x-clip bg-bg">
      <Sidebar items={items} gymName={gym?.name ?? "Opsyl Fit"} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-bg/90 px-4 pb-3 pt-5 backdrop-blur sm:px-6 lg:hidden">
          <NavDrawer items={items} />
          <div className="text-center">
            <p className="text-[13px] font-medium leading-[18px] text-text-secondary">{greeting}</p>
            <p className="text-[14px] font-semibold leading-5 text-text-primary">{session?.name}</p>
          </div>
          <NotificationsPanel />
        </header>

        {session?.role === "owner" && (
          <div className="flex justify-center px-4 pb-1 sm:px-6 lg:hidden"><GymSwitcher /></div>
        )}

        <div className="hidden items-center justify-end gap-3 px-8 pt-6 lg:flex">
          <GymSwitcher />
          <NotificationsPanel />
        </div>

        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-36 pt-2 sm:px-6 lg:px-8 lg:pb-12">
          <Outlet />
        </main>
      </div>
      <TabBar items={items} raisedTo={raisedTo} />
      <NotificationPrompt />
      <PaymentReturnHandler />
    </div>
  );
}
