import { Link } from "react-router-dom";
import { ScanLine, Dumbbell, Flame, Gift, LineChart as LineChartIcon } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb } from "../../api/db";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Card, CardTitle } from "../../components/ui/Card";
import { computeStreak, daysBetween, todayStr } from "../../lib/backend";
import { useMyPoints } from "./MemberRewards";
import { formatDate } from "../../lib/format";

export default function MemberHome() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const { data: points } = useMyPoints();
  const streak = db && session ? computeStreak(db, session.userId) : null;

  const sub = db?.subscriptions
    .filter((s) => s.memberId === session?.userId)
    .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  const plan = db?.plans.find((p) => p.planId === sub?.planId);
  const trainer = db?.members.find((m) => m.userId === session?.userId)?.assignedTrainerId;
  const trainerUser = db?.users.find((u) => u.userId === trainer);

  const today = todayStr();
  const daysLeft = sub ? daysBetween(today, sub.endDate) : 0;
  const totalDays = plan?.durationDays ?? 30;
  const percentLeft = Math.max(0, Math.min(100, Math.round((daysLeft / totalDays) * 100)));
  const isActive = sub?.status === "active" && daysLeft >= 0;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <p className="text-[13px] font-medium leading-[18px] text-text-secondary">Good to see you</p>
        <h1 className="text-[22px] font-semibold leading-[30px] text-text-primary">{session?.name}</h1>
      </div>

      <div className="relative flex h-[128px] w-full flex-col justify-between overflow-hidden rounded-[24px] bg-ink-deep p-5 text-white">
        <div className="absolute -right-6 -top-10 h-32 w-32 rounded-[30px] border border-white/10" aria-hidden="true" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[11px] text-white/60">{plan?.name ?? "No active plan"}</p>
            <p className="text-[16px] font-semibold">{isActive ? `${daysLeft} days left` : "Membership expired"}</p>
          </div>
          <Link to="/member/subscription" className="rounded-[10px] bg-white px-4 py-2 text-[12px] font-medium text-ink">
            Renew
          </Link>
        </div>
        <div className="relative">
          <ProgressBar percent={percentLeft} label={`${percentLeft}%`} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Link to="/member/checkin" className="flex flex-col items-center gap-2 rounded-[22px] bg-white p-4 text-center shadow-card">
          <ScanLine size={20} />
          <span className="text-[11px] font-medium">Check-in</span>
        </Link>
        <Link to="/member/trainer" className="flex flex-col items-center gap-2 rounded-[22px] bg-white p-4 text-center shadow-card">
          <Dumbbell size={20} />
          <span className="text-[11px] font-medium">My trainer</span>
        </Link>
        <Link to="/member/progress" className="flex flex-col items-center gap-2 rounded-[22px] bg-white p-4 text-center shadow-card">
          <LineChartIcon size={20} />
          <span className="text-[11px] font-medium">Progress</span>
        </Link>
      </div>

      <Link to="/member/rewards" className="flex items-center justify-between gap-3 rounded-[22px] bg-white p-4 shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-50 text-orange-500">
            <Flame size={22} />
          </span>
          <div>
            <p className="text-[14px] font-semibold">{streak?.current ?? 0} day streak</p>
            <p className="text-[12px] text-text-secondary">Keep coming to earn more points</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[12px] font-semibold text-on-ink">
          <Gift size={14} /> {points?.balance ?? 0} pts
        </div>
      </Link>

      <Card>
        <CardTitle>Your trainer</CardTitle>
        {trainerUser ? (
          <p className="mt-2 text-[14px] text-text-primary">{trainerUser.name}</p>
        ) : (
          <p className="mt-2 text-[13px] text-text-secondary">You are on the waitlist for a trainer. We will notify you once one is available.</p>
        )}
      </Card>

      {sub && (
        <Card>
          <CardTitle>Membership</CardTitle>
          <p className="mt-2 text-[13px] text-text-secondary">
            {plan?.name} plan, started {formatDate(sub.startDate)}, ends {formatDate(sub.endDate)}.
          </p>
        </Card>
      )}
    </div>
  );
}
