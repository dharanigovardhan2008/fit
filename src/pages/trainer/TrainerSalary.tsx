import { useMemo } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { Card, CardTitle } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/States";
import { formatCurrency, formatDate } from "../../lib/format";

export default function TrainerSalary() {
  const { session } = useAuth();
  const { data: db } = useDb();

  const trainer = db?.trainers.find((t) => t.userId === session?.userId);
  const payments = useMemo(
    () => (db?.salaryPayments ?? []).filter((p) => p.trainerId === session?.userId).sort((a, b) => b.month.localeCompare(a.month)),
    [db, session],
  );

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Salary" description="Your monthly pay and payment history." />

      <Card>
        <CardTitle>Current monthly salary</CardTitle>
        <p className="mt-2 text-[28px] font-semibold">{trainer ? formatCurrency(trainer.salary) : "-"}</p>
      </Card>

      <Card>
        <CardTitle>Payment history</CardTitle>
        {payments.length === 0 ? (
          <EmptyState title="No payments recorded yet" description="Your salary payments will be listed here once the owner records them." />
        ) : (
          <ul className="mt-3 divide-y divide-track">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3 text-[13px]">
                <span>{new Date(p.month).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
                <span className="text-text-secondary">{formatCurrency(p.amount)} - paid {formatDate(p.paidOn)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
