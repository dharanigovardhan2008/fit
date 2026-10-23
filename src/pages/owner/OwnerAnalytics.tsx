import { useMemo } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardTitle } from "../../components/ui/Card";
import { formatCurrency, formatDate } from "../../lib/format";
import { addDays, daysBetween, todayStr } from "../../lib/backend";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const PIE_COLORS = ["#2B2B2B", "#6B6B6B", "#B3B3B3", "#E9E9E9"];

export default function OwnerAnalytics() {
  const { session } = useAuth();
  const { data: db } = useDb();

  const data = useMemo(() => {
    if (!db || !session) return null;
    const gymId = session.gymId;
    const today = todayStr();

    const monthly: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1); // avoid month-end rollover (for example 31 Oct minus one month)
      d.setMonth(d.getMonth() - i);
      monthly[d.toISOString().slice(0, 7)] = 0;
    }
    db.payments.filter((p) => p.gymId === gymId).forEach((p) => {
      const key = p.paidAt.slice(0, 7);
      if (key in monthly) monthly[key] += p.amount;
    });
    const months = Object.keys(monthly);
    const values = Object.values(monthly);

    // The current month is still in progress, so the trend is fitted on completed months only.
    const done = values.slice(0, -1);
    const n = done.length;
    const meanX = (n - 1) / 2;
    const meanY = done.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    done.forEach((y, x) => { num += (x - meanX) * (y - meanY); den += (x - meanX) ** 2; });
    const slope = den === 0 ? 0 : num / den;
    const intercept = meanY - slope * meanX;
    const project = (x: number) => Math.max(0, Math.round(intercept + slope * x));

    const revenueForecast = months.map((m, i) => ({
      month: new Date(m + "-01").toLocaleDateString("en-GB", { month: "short" }),
      revenue: values[i] as number | null,
      forecast: null as number | null,
    }));
    // The dashed line starts at the last completed month so it joins the solid line.
    revenueForecast[n - 1].forecast = values[n - 1];
    // The current month shows the expected full-month figure, then the next three months follow.
    revenueForecast[n].forecast = project(n);
    for (let i = 1; i <= 3; i++) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() + i);
      revenueForecast.push({
        month: d.toLocaleDateString("en-GB", { month: "short" }), revenue: null,
        forecast: project(n + i),
      });
    }

    const heatmap: Record<number, number> = {};
    for (let h = 5; h <= 22; h++) heatmap[h] = 0;
    db.attendance.filter((a) => a.gymId === gymId && a.checkIn && a.attendanceDate >= addDays(today, -30)).forEach((a) => {
      const hour = new Date(a.checkIn!).getUTCHours();
      heatmap[hour] = (heatmap[hour] ?? 0) + 1;
    });
    const heatmapChart = Object.entries(heatmap).map(([hour, visits]) => ({ hour: `${hour}:00`, visits }));

    const members = db.members.filter((m) => m.gymId === gymId);
    const retention = [1, 3, 6].map((months) => {
      const cohort = members.filter((m) => daysBetween(m.joinedOn, today) >= months * 30);
      const retained = cohort.filter((m) => {
        const sub = db.subscriptions.filter((s) => s.memberId === m.userId).sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
        return sub && sub.endDate >= addDays(m.joinedOn, months * 30 - 10);
      });
      return { months: `${months} mo`, rate: cohort.length ? Math.round((retained.length / cohort.length) * 100) : 0 };
    });

    const trainerPerformance = db.trainers.filter((t) => t.gymId === gymId).map((t) => {
      const user = db.users.find((u) => u.userId === t.userId)!;
      const ratings = db.ratings.filter((r) => r.trainerId === t.userId);
      const avg = ratings.length ? ratings.reduce((s, r) => s + r.score, 0) / ratings.length : 0;
      const memberCount = members.filter((m) => m.assignedTrainerId === t.userId).length;
      return { name: user.name.split(" ")[0], rating: Number(avg.toFixed(1)), members: memberCount };
    });

    const planCounts = new Map<string, number>();
    db.subscriptions.filter((s) => s.gymId === gymId && s.status === "active").forEach((s) => {
      const plan = db.plans.find((p) => p.planId === s.planId);
      if (plan) planCounts.set(plan.name, (planCounts.get(plan.name) ?? 0) + 1);
    });
    const planPopularity = Array.from(planCounts.entries()).map(([name, value]) => ({ name, value }));

    return { revenueForecast, heatmapChart, retention, trainerPerformance, planPopularity };
  }, [db, session]);

  if (!data) return null;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Analytics" description="Trends across revenue, attendance, retention and performance." />

      <Card>
        <CardTitle>Revenue with 3-month forecast</CardTitle>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.revenueForecast}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9A9A9A" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#9A9A9A" }} axisLine={false} tickLine={false} width={48} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }} />
              <Area type="monotone" dataKey="revenue" stroke="#2B2B2B" fill="#2B2B2B22" strokeWidth={2} connectNulls={false} />
              <Area type="monotone" dataKey="forecast" stroke="#9A9A9A" strokeDasharray="5 4" fill="transparent" strokeWidth={2} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11px] text-text-secondary">
          The solid line is money received so far. The current month is still in progress, and the dashed line shows the expected full month and the next three.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Peak hours (last 30 days)</CardTitle>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.heatmapChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#9A9A9A" }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fontSize: 12, fill: "#9A9A9A" }} axisLine={false} tickLine={false} width={32} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }} />
                <Bar dataKey="visits" fill="#2B2B2B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardTitle>Retention curve</CardTitle>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.retention}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="months" tick={{ fontSize: 12, fill: "#9A9A9A" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#9A9A9A" }} axisLine={false} tickLine={false} width={40} unit="%" />
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }} />
                <Line type="monotone" dataKey="rate" stroke="#2B2B2B" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardTitle>Trainer performance</CardTitle>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.trainerPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9A9A9A" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#9A9A9A" }} axisLine={false} tickLine={false} width={32} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }} />
                <Bar dataKey="rating" fill="#2B2B2B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardTitle>Plan popularity</CardTitle>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.planPopularity} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {data.planPopularity.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 flex flex-wrap gap-3 text-[11px] text-text-secondary">
            {data.planPopularity.map((p, i) => (
              <li key={p.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {p.name} ({p.value})
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <p className="text-[11px] text-text-secondary">Snapshot generated {formatDate(todayStr())}.</p>
    </div>
  );
}
