import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardTitle } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/States";
import { useToast } from "../../components/ui/Toast";
import { addBodyMetric } from "../../lib/backend";
import { formatDate } from "../../lib/format";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function MemberProgress() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");

  const metrics = useMemo(
    () => (db?.bodyMetrics ?? []).filter((m) => m.memberId === session?.userId).sort((a, b) => a.recordedOn.localeCompare(b.recordedOn)),
    [db, session],
  );
  const chartData = metrics.map((m) => ({ date: formatDate(m.recordedOn), weight: m.weightKg, waist: m.waistCm }));

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Progress" description="Log your weight and waist measurements over time." />

      <Card>
        <CardTitle>Log today's measurement</CardTitle>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!session || (!weight && !waist)) return;
            await addBodyMetric(session.gymId, session.userId, weight ? Number(weight) : null, waist ? Number(waist) : null);
            invalidate();
            setWeight("");
            setWaist("");
            notify("Progress saved");
          }}
        >
          <Input id="weight" label="Weight (kg)" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
          <Input id="waist" label="Waist (cm)" type="number" value={waist} onChange={(e) => setWaist(e.target.value)} />
          <div className="flex items-end">
            <Button type="submit" fullWidth>Save</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>Weight trend</CardTitle>
        {metrics.length === 0 ? (
          <EmptyState title="No measurements yet" description="Log your first weight and waist measurement to start tracking progress." />
        ) : (
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9A9A9A" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#9A9A9A" }} axisLine={false} tickLine={false} width={36} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }} />
                <Line type="monotone" dataKey="weight" stroke="#2B2B2B" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
