import { useMemo } from "react";
import { Users, CalendarCheck, Star } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import { Card, CardTitle } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/States";
import { todayStr } from "../../lib/backend";
import { initials } from "../../lib/format";

export default function TrainerHome() {
  const { session } = useAuth();
  const { data: db } = useDb();

  const stats = useMemo(() => {
    if (!db || !session) return null;
    const today = todayStr();
    const myMembers = db.members.filter((m) => m.assignedTrainerId === session.userId);
    const presentToday = db.attendance.filter(
      (a) => a.attendanceDate === today && myMembers.some((m) => m.userId === a.memberId) && a.checkIn,
    );
    const ratings = db.ratings.filter((r) => r.trainerId === session.userId);
    const avgRating = ratings.length ? ratings.reduce((s, r) => s + r.score, 0) / ratings.length : null;
    return { myMembers, presentToday, avgRating };
  }, [db, session]);

  if (!stats) return null;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Today" description="Your members and how training is going." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="My members" value={String(stats.myMembers.length)} icon={Users} />
        <StatCard label="Checked in today" value={String(stats.presentToday.length)} icon={CalendarCheck} />
        <StatCard label="My rating" value={stats.avgRating ? stats.avgRating.toFixed(1) : "-"} icon={Star} />
      </div>

      <Card>
        <CardTitle>Today's attendance</CardTitle>
        {stats.presentToday.length === 0 ? (
          <EmptyState title="No check-ins yet" description="Members assigned to you will show up here once they check in today." />
        ) : (
          <ul className="mt-3 divide-y divide-track">
            {stats.presentToday.map((a) => {
              const member = db?.users.find((u) => u.userId === a.memberId);
              return (
                <li key={a.attId} className="flex items-center gap-3 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-thumb text-[11px] font-semibold">
                    {initials(member?.name ?? "")}
                  </div>
                  <p className="text-[13px] font-medium">{member?.name}</p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
