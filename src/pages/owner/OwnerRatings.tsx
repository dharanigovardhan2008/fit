import { useMemo } from "react";
import { Star, AlertTriangle } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardTitle } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Chip";
import { EmptyState } from "../../components/ui/States";

export default function OwnerRatings() {
  const { session } = useAuth();
  const { data: db } = useDb();

  const trainerRatings = useMemo(() => {
    if (!db || !session) return [];
    return db.trainers
      .filter((t) => t.gymId === session.gymId)
      .map((t) => {
        const user = db.users.find((u) => u.userId === t.userId)!;
        const ratings = db.ratings.filter((r) => r.trainerId === t.userId);
        const avg = ratings.length ? ratings.reduce((s, r) => s + r.score, 0) / ratings.length : null;
        return { user, count: ratings.length, avg };
      })
      .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
  }, [db, session]);

  const equipmentRatings = useMemo(() => {
    if (!db || !session) return [];
    return db.equipment
      .filter((e) => e.gymId === session.gymId)
      .map((e) => {
        const ratings = db.ratings.filter((r) => r.equipmentId === e.equipmentId);
        const avg = ratings.length ? ratings.reduce((s, r) => s + r.score, 0) / ratings.length : e.conditionScore;
        return { equipment: e, count: ratings.length, avg };
      })
      .sort((a, b) => a.avg - b.avg);
  }, [db, session]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Ratings" description="See how members rate trainers and equipment." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Trainer ratings</CardTitle>
          {trainerRatings.length === 0 ? (
            <EmptyState title="No ratings yet" description="Ratings appear once members with 8 or more attended days rate their trainer." />
          ) : (
            <ul className="mt-4 divide-y divide-track">
              {trainerRatings.map(({ user, count, avg }) => (
                <li key={user.userId} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-[13px] font-medium">{user.name}</p>
                    <p className="text-[11px] text-text-secondary">{count} rating{count === 1 ? "" : "s"}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[13px] font-semibold">
                    <Star size={14} className="fill-ink text-ink" />
                    {avg ? avg.toFixed(1) : "-"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>Equipment ratings</CardTitle>
          <ul className="mt-4 divide-y divide-track">
            {equipmentRatings.map(({ equipment, count, avg }) => (
              <li key={equipment.equipmentId} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-[13px] font-medium">{equipment.name}</p>
                  <p className="text-[11px] text-text-secondary">{count} rating{count === 1 ? "" : "s"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {avg < 3 && <Badge tone="danger"><AlertTriangle size={11} className="mr-1 inline" />Needs service</Badge>}
                  <div className="flex items-center gap-1 text-[13px] font-semibold">
                    <Star size={14} className="fill-ink text-ink" />
                    {avg.toFixed(1)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
