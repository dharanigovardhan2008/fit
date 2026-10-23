import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Input";
import { useToast } from "../../components/ui/Toast";
import { addRating, ratingEligibility } from "../../lib/backend";
import { cn } from "../../utils/cn";

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const starValue = i + 1;
        return (
          <button key={i} type="button" aria-label={`Rate ${starValue} stars`} onClick={() => onChange(starValue)}>
            <Star size={28} className={cn(starValue <= value ? "fill-ink text-ink" : "text-track")} />
          </button>
        );
      })}
    </div>
  );
}

export default function MemberRate() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();

  const eligibility = session ? ratingEligibility(session.gymId, session.userId) : { eligible: false, attendedDays: 0 };
  const member = db?.members.find((m) => m.userId === session?.userId);
  const trainer = member?.assignedTrainerId ? db?.users.find((u) => u.userId === member.assignedTrainerId) : null;
  const equipment = useMemo(() => (db?.equipment ?? []).filter((e) => e.gymId === session?.gymId), [db, session]);

  const [trainerScore, setTrainerScore] = useState(0);
  const [trainerComment, setTrainerComment] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [equipmentScore, setEquipmentScore] = useState(0);
  const [equipmentComment, setEquipmentComment] = useState("");

  async function rateTrainer() {
    if (!session || !trainer || trainerScore === 0) return;
    try {
      await addRating(session.gymId, session.userId, { trainerId: trainer.userId, score: trainerScore, comment: trainerComment });
      invalidate();
      notify("Thanks for rating your trainer");
      setTrainerScore(0);
      setTrainerComment("");
    } catch (err) {
      notify(err instanceof Error ? err.message : "We could not submit your rating.", "error");
    }
  }

  async function rateEquipment() {
    if (!session || !equipmentId || equipmentScore === 0) return;
    try {
      await addRating(session.gymId, session.userId, { equipmentId, score: equipmentScore, comment: equipmentComment });
      invalidate();
      notify("Thanks for your feedback");
      setEquipmentId("");
      setEquipmentScore(0);
      setEquipmentComment("");
    } catch (err) {
      notify(err instanceof Error ? err.message : "We could not submit your rating.", "error");
    }
  }

  if (!eligibility.eligible) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        <PageHeader title="Rate" />
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <Star size={28} className="text-text-secondary" />
          <p className="text-[14px] font-semibold">Rating is locked for now</p>
          <p className="max-w-xs text-[12px] leading-5 text-text-secondary">
            Attend at least 8 days in the last 30 days to unlock ratings. You have attended {eligibility.attendedDays} day{eligibility.attendedDays === 1 ? "" : "s"} so far.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Rate" description="Share feedback about your trainer and the equipment you use." />

      {trainer && (
        <Card className="flex flex-col gap-3">
          <CardTitle>Rate {trainer.name}</CardTitle>
          <StarPicker value={trainerScore} onChange={setTrainerScore} />
          <Textarea id="trainer-comment" label="Comment (optional)" value={trainerComment} onChange={(e) => setTrainerComment(e.target.value)} />
          <Button onClick={rateTrainer} disabled={trainerScore === 0}>Submit rating</Button>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <CardTitle>Rate equipment</CardTitle>
        <div className="flex flex-wrap gap-2">
          {equipment.map((e) => (
            <button
              key={e.equipmentId}
              type="button"
              onClick={() => setEquipmentId(e.equipmentId)}
              className={cn(
                "rounded-full px-4 py-2 text-[12px] font-medium",
                equipmentId === e.equipmentId ? "bg-ink text-on-ink" : "bg-thumb text-text-secondary",
              )}
            >
              {e.name}
            </button>
          ))}
        </div>
        {equipmentId && (
          <>
            <StarPicker value={equipmentScore} onChange={setEquipmentScore} />
            <Textarea id="equipment-comment" label="Comment (optional)" value={equipmentComment} onChange={(e) => setEquipmentComment(e.target.value)} />
            <Button onClick={rateEquipment} disabled={equipmentScore === 0}>Submit rating</Button>
          </>
        )}
      </Card>
    </div>
  );
}
