import { useState, type FormEvent } from "react";
import { Megaphone } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Dropdown } from "../../components/ui/Dropdown";
import { Input, Textarea } from "../../components/ui/Input";
import { EmptyState } from "../../components/ui/States";
import { useToast } from "../../components/ui/Toast";
import { sendAnnouncement } from "../../lib/backend";
import { formatDateTime } from "../../lib/format";

const AUDIENCE = { all: "Everyone", members: "Members only", trainers: "Trainers only" } as const;

export default function OwnerAnnouncements() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<keyof typeof AUDIENCE>("members");
  const [sending, setSending] = useState(false);

  const history = (db?.announcements ?? [])
    .filter((a) => a.gymId === session?.gymId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      const count = await sendAnnouncement(title, message, audience);
      invalidate();
      notify(`Sent to ${count} ${count === 1 ? "person" : "people"}`);
      setTitle("");
      setMessage("");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not send the announcement.", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Announcements" description="Send a message that pops up on every phone, for example a holiday or a new batch." />

      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Dropdown
            id="ann-audience"
            label="Send to"
            value={audience}
            onChange={(v) => setAudience(v as keyof typeof AUDIENCE)}
            options={Object.entries(AUDIENCE).map(([value, label]) => ({ value, label }))}
          />
          <Input id="ann-title" label="Title (optional)" placeholder="e.g. Holiday notice" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
          <Textarea
            id="ann-message"
            label="Message"
            required
            rows={4}
            maxLength={300}
            placeholder="We are closed on Diwali. See you the day after!"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <Button type="submit" size="lg" fullWidth loading={sending} disabled={!message.trim()}>
            <Megaphone size={16} /> Send announcement
          </Button>
        </form>
      </Card>

      <div>
        <h2 className="mb-3 text-[15px] font-semibold">Sent so far</h2>
        {history.length === 0 ? (
          <EmptyState title="Nothing sent yet" description="Your announcements will be listed here." />
        ) : (
          <div className="grid gap-3">
            {history.map((a) => (
              <Card key={a.id}>
                {a.title && <p className="text-[14px] font-semibold">{a.title}</p>}
                <p className="text-[13px] leading-5 text-text-primary">{a.message}</p>
                <p className="mt-2 text-[11px] text-text-secondary">
                  {AUDIENCE[a.audience]} · {a.sentTo} people · {formatDateTime(a.createdAt)}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
