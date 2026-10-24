import { useMemo, useState, type FormEvent } from "react";
import { Salad, Dumbbell, Trash2 } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Chip";
import { Button } from "../../components/ui/Button";
import { Dropdown } from "../../components/ui/Dropdown";
import { Input, Textarea } from "../../components/ui/Input";
import { EmptyState } from "../../components/ui/States";
import { useToast } from "../../components/ui/Toast";
import { PLAN_TEMPLATES } from "../../lib/planTemplates";
import { addDaysPublic, addMemberPlan, deleteMemberPlan, todayStr } from "../../lib/backend";
import { formatDate } from "../../lib/format";

// Used by trainers (their own members) and owners (every member).
export default function PlansManager() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();

  const members = useMemo(() => {
    if (!db || !session) return [];
    return db.members
      .filter((m) => m.gymId === session.gymId && (session.role === "owner" || m.assignedTrainerId === session.userId))
      .map((m) => ({ id: m.userId, name: db.users.find((u) => u.userId === m.userId)?.name ?? "Member" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [db, session]);

  const [memberId, setMemberId] = useState("");
  const [kind, setKind] = useState<"diet" | "workout">("workout");
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const templates = PLAN_TEMPLATES.filter((t) => t.kind === kind);

  function chooseTemplate(id: string) {
    setTemplateId(id);
    const t = PLAN_TEMPLATES.find((x) => x.id === id);
    if (t) {
      setTitle(t.title);
      setContent(t.content);
    }
  }

  const today = todayStr();
  const from = addDaysPublic(today, -6);
  const shown = (db?.memberPlans ?? [])
    .filter((p) => !memberId || p.memberId === memberId)
    .filter((p) => members.some((m) => m.id === p.memberId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session || !memberId || !title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      await addMemberPlan(session, { memberId, kind, title, content });
      invalidate();
      notify("Plan sent to the member");
      setTitle("");
      setContent("");
      setTemplateId("");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not save the plan.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Diet & Workout Plans" description="Give a member a plan. They get an alert and can tick it off every day." />

      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Dropdown
            id="plan-member"
            label="Member"
            required
            value={memberId}
            onChange={setMemberId}
            placeholder={members.length === 0 ? "No members yet" : "Select a member"}
            options={members.map((m) => ({ value: m.id, label: m.name }))}
          />
          <Dropdown
            id="plan-kind"
            label="Type"
            value={kind}
            onChange={(v) => {
              setKind(v as "diet" | "workout");
              setTemplateId("");
            }}
            options={[{ value: "workout", label: "Workout plan" }, { value: "diet", label: "Diet plan" }]}
          />
          <Dropdown
            id="plan-template"
            label="Ready-made plan (optional)"
            value={templateId}
            onChange={chooseTemplate}
            placeholder="Start from a ready-made plan, or write your own"
            options={templates.map((t) => ({ value: t.id, label: t.title }))}
          />
          <Input id="plan-title" label="Title" required placeholder="e.g. Fat loss, week 1" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            id="plan-content"
            label="Plan"
            required
            rows={12}
            placeholder={"Mon: Chest and triceps\nTue: Back and biceps\n..."}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <Button type="submit" size="lg" fullWidth loading={saving} disabled={!memberId || !title.trim() || !content.trim()}>
            Send plan
          </Button>
        </form>
      </Card>

      <div>
        <h2 className="mb-3 text-[15px] font-semibold">Plans given {memberId ? "to this member" : ""}</h2>
        {shown.length === 0 ? (
          <EmptyState title="No plans yet" description="Plans you send will be listed here with how often the member ticks them off." />
        ) : (
          <div className="grid gap-3">
            {shown.map((p) => {
              const name = members.find((m) => m.id === p.memberId)?.name;
              const doneDays = (db?.memberPlanLogs ?? []).filter((l) => l.planId === p.id && l.logDate >= from).length;
              return (
                <Card key={p.id} className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-thumb">
                      {p.kind === "diet" ? <Salad size={16} /> : <Dumbbell size={16} />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold">{p.title}</p>
                      <p className="text-[12px] text-text-secondary">{name} · {formatDate(p.createdAt)}</p>
                      <div className="mt-2"><Badge tone={doneDays >= 5 ? "success" : "neutral"}>{doneDays}/7 days done this week</Badge></div>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Delete plan"
                    onClick={async () => {
                      if (!window.confirm("Delete this plan?")) return;
                      try { await deleteMemberPlan(p.id); invalidate(); } catch (err) {
                        notify(err instanceof Error ? err.message : "Could not delete.", "error");
                      }
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 size={16} />
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
