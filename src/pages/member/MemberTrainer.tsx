import { useAuth } from "../../auth/AuthContext";
import { useDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardTitle } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Chip";
import { EmptyState } from "../../components/ui/States";
import { initials } from "../../lib/format";

export default function MemberTrainer() {
  const { session } = useAuth();
  const { data: db } = useDb();

  const member = db?.members.find((m) => m.userId === session?.userId);
  const trainer = member?.assignedTrainerId ? db?.trainers.find((t) => t.userId === member.assignedTrainerId) : null;
  const trainerUser = trainer ? db?.users.find((u) => u.userId === trainer.userId) : null;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="My Trainer" />

      {!trainerUser ? (
        <EmptyState
          title={member?.waitlisted ? "You are on the waitlist" : "No trainer assigned yet"}
          description="We will notify you as soon as a trainer with capacity for your preferred shift is available."
        />
      ) : (
        <Card className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ink text-[18px] font-semibold text-on-ink">
            {initials(trainerUser.name)}
          </div>
          <div>
            <p className="text-[16px] font-semibold">{trainerUser.name}</p>
            <p className="text-[12px] text-text-secondary">{trainer?.specialty}</p>
            <Badge tone="neutral" className="mt-2 capitalize">{trainer?.shift} shift</Badge>
          </div>
        </Card>
      )}

      <Card>
        <CardTitle>Your goal</CardTitle>
        <p className="mt-2 text-[13px] text-text-secondary">{member?.goal || "No goal has been noted yet."}</p>
      </Card>
    </div>
  );
}
