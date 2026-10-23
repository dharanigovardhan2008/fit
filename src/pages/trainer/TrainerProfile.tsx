import { Link } from "react-router-dom";
import { ChevronRight, LogOut } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card } from "../../components/ui/Card";
import { initials } from "../../lib/format";

const links = [
  { to: "/trainer/salary", label: "Salary and payments" },
  { to: "/trainer/rating", label: "My rating" },
  { to: "/trainer/alerts", label: "Alerts" },
  { to: "/trainer/requests", label: "Requests" },
];

export default function TrainerProfile() {
  const { session, logout } = useAuth();
  const { data: db } = useDb();
  const trainer = db?.trainers.find((t) => t.userId === session?.userId);
  const user = db?.users.find((u) => u.userId === session?.userId);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Profile" />

      <Card className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-[16px] font-semibold text-on-ink">
          {initials(session?.name ?? "")}
        </div>
        <div>
          <p className="text-[16px] font-semibold">{session?.name}</p>
          <p className="text-[12px] text-text-secondary">{session?.publicId} - {trainer?.specialty}</p>
          <p className="text-[12px] text-text-secondary">{user?.email}</p>
        </div>
      </Card>

      <Card className="divide-y divide-track p-0">
        {links.map((item) => (
          <Link key={item.to} to={item.to} className="flex items-center justify-between px-5 py-4">
            <span className="text-[14px] font-medium">{item.label}</span>
            <ChevronRight size={16} className="text-text-secondary" />
          </Link>
        ))}
      </Card>

      <button
        type="button"
        onClick={logout}
        className="flex items-center justify-center gap-2 rounded-2xl border border-danger/30 bg-white py-3 text-[13px] font-medium text-danger"
      >
        <LogOut size={16} /> Log out
      </button>
    </div>
  );
}
