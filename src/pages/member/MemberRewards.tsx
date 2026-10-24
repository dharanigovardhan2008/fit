import { useQuery } from "@tanstack/react-query";
import { Flame, Gift, Lock, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { computeStreak, getPoints } from "../../lib/backend";
import { formatCurrency } from "../../lib/format";

export function useMyPoints() {
  const { session } = useAuth();
  const { data: db } = useDb();
  return useQuery({
    queryKey: ["points", session?.userId, db?.attendance.length ?? 0, db?.payments.length ?? 0],
    queryFn: () => getPoints(session!.userId),
    enabled: !!session,
  });
}

export default function MemberRewards() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const { data: points } = useMyPoints();
  const streak = db && session ? computeStreak(db, session.userId) : null;
  const worth = points ? Math.floor(points.balance * points.pointValue) : 0;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Rewards" description="Earn points every day you train and use them to save on your next renewal." />

      <div
        className="relative overflow-hidden rounded-[24px] p-6 text-white"
        style={{ backgroundImage: "linear-gradient(145deg, #0a3cff 0%, #0057ff 50%, #2ec5ff 100%)" }}
      >
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" aria-hidden="true" />
        <p className="relative text-[12px] text-white/70">Your points</p>
        <p className="relative text-[40px] font-semibold leading-[48px]">{points?.balance ?? "-"}</p>
        <p className="relative text-[13px] text-white/80">Worth {formatCurrency(worth)} off your next renewal</p>
        <Link to="/member/subscription" className="relative mt-4 inline-block">
          <Button variant="secondary" className="border-white/30 bg-white text-ink">
            <Gift size={16} /> Use points
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-50 text-orange-500">
            <Flame size={22} />
          </span>
          <div>
            <p className="text-[22px] font-semibold leading-6">{streak?.current ?? 0}</p>
            <p className="text-[11px] text-text-secondary">day streak</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-500">
            <Trophy size={22} />
          </span>
          <div>
            <p className="text-[22px] font-semibold leading-6">{streak?.longest ?? 0}</p>
            <p className="text-[11px] text-text-secondary">best streak</p>
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Badges</CardTitle>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(streak?.badges ?? []).map((b) => (
            <li
              key={b.id}
              className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-4 text-center ${b.earned ? "bg-ink text-on-ink" : "bg-thumb text-text-secondary"}`}
            >
              {b.earned ? <Trophy size={20} /> : <Lock size={18} />}
              <span className="text-[12px] font-semibold">{b.label}</span>
              <span className="text-[10px] opacity-70">{b.earned ? "Earned" : b.hint}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>How it works</CardTitle>
        <ul className="mt-3 flex flex-col gap-2 text-[12px] leading-5 text-text-secondary">
          <li>Earn {points?.pointsPerVisit ?? 10} points for every day you check in.</li>
          <li>Earn a bonus of {points?.streakBonus ?? 50} points for every 7 days in a row.</li>
          <li>Each point is worth {formatCurrency(points?.pointValue ?? 0.5)}. Points can cover up to {points?.maxDiscountPct ?? 30}% of a plan.</li>
          <li>You have attended {points?.visits ?? 0} days and used {points?.redeemed ?? 0} points so far.</li>
        </ul>
      </Card>
    </div>
  );
}
