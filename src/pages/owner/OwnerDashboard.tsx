import { useMemo } from "react";
import { Users, Wallet, CalendarClock, TrendingUp, AlertTriangle, Activity } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import { Card, CardTitle } from "../../components/ui/Card";
import { CardSkeleton } from "../../components/ui/States";
import { formatCurrency, formatDate } from "../../lib/format";
import { addDays, daysBetween, todayStr } from "../../lib/backend";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export default function OwnerDashboard() {
  const { session } = useAuth();
  const { data: db, isLoading } = useDb();

  const stats = useMemo(() => {
    if (!db || !session) return null;
    const gymId = session.gymId;
    const today = todayStr();
    const members = db.members.filter((m) => m.gymId === gymId);
    const subs = db.subscriptions.filter((s) => s.gymId === gymId);
    const activeSubs = subs.filter((s) => s.status === "active" && s.endDate >= today);
    const expiringSoon = activeSubs.filter((s) => daysBetween(today, s.endDate) <= 7);
    const insideNow = db.attendance.filter(
      (a) => a.gymId === gymId && a.attendanceDate === today && a.checkIn && !a.checkOut,
    ).length;
    const monthPrefix = today.slice(0, 7);
    const revenueThisMonth = db.payments
      .filter((p) => p.gymId === gymId && p.paidAt.startsWith(monthPrefix))
      .reduce((sum, p) => sum + p.amount, 0);
    const churnAlerts = db.churnAlerts.filter((a) => a.gymId === gymId);

    const revenueByMonth: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      revenueByMonth[key] = 0;
    }
    db.payments
      .filter((p) => p.gymId === gymId)
      .forEach((p) => {
        const key = p.paidAt.slice(0, 7);
        if (key in revenueByMonth) revenueByMonth[key] += p.amount;
      });
    const revenueChart = Object.entries(revenueByMonth).map(([month, revenue]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-GB", { month: "short" }),
      revenue,
    }));

    const heatmap: Record<number, number> = {};
    for (let h = 5; h <= 22; h++) heatmap[h] = 0;
    db.attendance
      .filter((a) => a.gymId === gymId && a.checkIn && a.attendanceDate >= addDays(today, -30))
      .forEach((a) => {
        const hour = new Date(a.checkIn!).getUTCHours();
        heatmap[hour] = (heatmap[hour] ?? 0) + 1;
      });
    const heatmapChart = Object.entries(heatmap).map(([hour, visits]) => ({ hour: `${hour}:00`, visits }));

    return { members, insideNow, activeSubs, expiringSoon, revenueThisMonth, churnAlerts, revenueChart, heatmapChart };
  }, [db, session]);

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Dashboard" description="A snapshot of how your gym is doing today." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Inside now" value={String(stats.insideNow)} icon={Activity} tone="ink" sub="Checked in, not out yet" />
        <StatCard label="Active subscriptions" value={String(stats.activeSubs.length)} icon={Users} />
        <StatCard label="Expiring in 7 days" value={String(stats.expiringSoon.length)} icon={CalendarClock} />
        <StatCard label="Revenue this month" value={formatCurrency(stats.revenueThisMonth)} icon={Wallet} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>Monthly revenue</CardTitle>
            <TrendingUp size={16} className="text-text-secondary" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.revenueChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9A9A9A" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#9A9A9A" }} axisLine={false} tickLine={false} width={48} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }} />
                <Line type="monotone" dataKey="revenue" stroke="#2B2B2B" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>Churn risk</CardTitle>
            <AlertTriangle size={16} className="text-warning" />
          </div>
          <p className="text-[32px] font-semibold leading-10">{stats.churnAlerts.length}</p>
          <p className="text-[12px] text-text-secondary">members flagged at risk of leaving</p>
          <p className="mt-4 text-[12px] leading-5 text-text-secondary">
            Review these in Alerts and reach out before their subscription lapses.
          </p>
        </Card>
      </div>

      <Card>
        <CardTitle>Peak hours (last 30 days)</CardTitle>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.heatmapChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#9A9A9A" }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={{ fontSize: 12, fill: "#9A9A9A" }} axisLine={false} tickLine={false} width={32} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }} />
              <Bar dataKey="visits" fill="#2B2B2B" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {stats.expiringSoon.length > 0 && (
        <Card>
          <CardTitle>Expiring soon</CardTitle>
          <ul className="mt-3 divide-y divide-track">
            {stats.expiringSoon.slice(0, 5).map((s) => {
              const member = db?.users.find((u) => u.userId === s.memberId);
              return (
                <li key={s.subId} className="flex items-center justify-between py-3 text-[13px]">
                  <span>{member?.name ?? "Member"}</span>
                  <span className="text-text-secondary">Ends {formatDate(s.endDate)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
