import { useMemo } from "react";
import { Star } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardTitle } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/States";
import { formatDate } from "../../lib/format";

export default function TrainerRating() {
  const { session } = useAuth();
  const { data: db } = useDb();

  const ratings = useMemo(
    () => (db?.ratings ?? []).filter((r) => r.trainerId === session?.userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db, session],
  );
  const avg = ratings.length ? ratings.reduce((s, r) => s + r.score, 0) / ratings.length : null;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="My Rating" description="Feedback members have left about training with you." />

      <Card className="flex flex-col items-center gap-2 py-8">
        <p className="text-[40px] font-semibold leading-none">{avg ? avg.toFixed(1) : "-"}</p>
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={18} className={i < Math.round(avg ?? 0) ? "fill-ink text-ink" : "text-track"} />
          ))}
        </div>
        <p className="text-[12px] text-text-secondary">{ratings.length} rating{ratings.length === 1 ? "" : "s"}</p>
      </Card>

      <Card>
        <CardTitle>Comments</CardTitle>
        {ratings.filter((r) => r.comment).length === 0 ? (
          <EmptyState title="No comments yet" description="Written feedback from your members will appear here." />
        ) : (
          <ul className="mt-3 divide-y divide-track">
            {ratings.filter((r) => r.comment).map((r) => (
              <li key={r.ratingId} className="py-3">
                <div className="mb-1 flex items-center gap-1">
                  {Array.from({ length: r.score }).map((_, i) => <Star key={i} size={12} className="fill-ink text-ink" />)}
                </div>
                <p className="text-[13px] text-text-primary">{r.comment}</p>
                <p className="text-[11px] text-text-secondary">{formatDate(r.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
