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
import { sendAnnouncement, sendTestNotification } from "../../lib/backend";
import { BellRing } from "lucide-react";
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

  const [testUser, setTestUser] = useState("");
  const [testing, setTesting] = useState(false);
  const people = (db?.users ?? [])
    .filter((u) => u.gymId === session?.gymId && u.isActive && (u.role === "member" || u.role === "trainer"))
    .sort((a, b) => a.name.localeCompare(b.name));

  async function sendTest() {
    if (!testUser) return;
    setTesting(true);
    try {
      const devices = await sendTestNotification(testUser);
      invalidate();
      const name = people.find((p) => p.userId === testUser)?.name ?? "them";
      notify(
        devices > 0
          ? `Test alert sent to ${name}. It should pop up on their phone in a few seconds.`
          : `Sent in the app, but ${name} has not turned on phone alerts yet. Ask them to tap the bell and Turn on.`,
        devices > 0 ? "success" : "error",
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not send the test.", "error");
    } finally {
      setTesting(false);
    }
  }

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

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-[15px] font-semibold">Test alerts</h2>
          <p className="mt-1 text-[12px] leading-5 text-text-secondary">
            Send a test alert to one person to check that their phone gets notifications.
          </p>
        </div>
        <Dropdown
          id="test-user"
          label="Send test to"
          value={testUser}
          onChange={setTestUser}
          placeholder={people.length === 0 ? "No members yet" : "Select a member or trainer"}
          options={people.map((u) => ({ value: u.userId, label: `${u.name} (${u.publicId})` }))}
        />
        <Button variant="secondary" fullWidth loading={testing} disabled={!testUser} onClick={sendTest}>
          <BellRing size={16} /> Send test notification
        </Button>
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
