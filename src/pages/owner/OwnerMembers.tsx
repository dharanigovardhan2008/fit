import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Plus, Clock, Trash2 } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { SearchField } from "../../components/ui/SearchField";
import { Chip, Badge } from "../../components/ui/Chip";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Input, Select } from "../../components/ui/Input";
import { EmptyState } from "../../components/ui/States";
import { useToast } from "../../components/ui/Toast";
import { createMember, deleteUser, startMemberPayment, type CreatedCredentials } from "../../lib/backend";
import { formatCurrency } from "../../lib/format";
import { ConfirmDelete } from "../../components/ui/ConfirmDelete";
import { formatDate, initials } from "../../lib/format";
import { CredentialsPanel } from "./OwnerTrainers";

interface MemberFormValues {
  name: string; age: string; gender: "male" | "female" | "other"; phone: string; email: string;
  planId: string; amountPaid: string; paymentMode: "cash" | "upi" | "card";
  preferredShift: "morning" | "evening" | "full"; goal: string;
}

export default function OwnerMembers() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "waitlisted" | "expired">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  const [credentials, setCredentials] = useState<CreatedCredentials | null>(null);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<MemberFormValues>({
    defaultValues: { gender: "male", preferredShift: "full", paymentMode: "cash" },
  });

  const plans = (db?.plans ?? []).filter((p) => p.gymId === session?.gymId);
  const watchedPlanId = watch("planId");
  const watchedMode = watch("paymentMode");
  const planPrice = plans.find((p) => p.planId === watchedPlanId)?.price ?? 0;
  const payOnlineMode = watchedMode === "upi";

  const rows = useMemo(() => {
    if (!db || !session) return [];
    const today = new Date().toISOString().slice(0, 10);
    return db.members
      .filter((m) => m.gymId === session.gymId)
      .map((m) => {
        const user = db.users.find((u) => u.userId === m.userId)!;
        const trainer = m.assignedTrainerId ? db.users.find((u) => u.userId === m.assignedTrainerId) : undefined;
        const sub = db.subscriptions
          .filter((s) => s.memberId === m.userId)
          .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
        const isActive = !!sub && sub.status === "active" && sub.endDate >= today;
        return { member: m, user, trainer, sub, isActive };
      })
      .filter((row) => row.user.name.toLowerCase().includes(search.toLowerCase()) || row.user.publicId.toLowerCase().includes(search.toLowerCase()))
      .filter((row) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "waitlisted") return row.member.waitlisted;
        if (statusFilter === "active") return row.isActive;
        return !row.isActive;
      });
  }, [db, session, search, statusFilter]);

  async function onSubmit(values: MemberFormValues) {
    if (!session) return;
    try {
      if (values.paymentMode === "upi") {
        // Online: go to Cashfree first. The member is created once the payment is confirmed.
        const amount = Number(values.amountPaid || planPrice);
        if (!(amount >= 1)) {
          notify("Enter an amount of at least 1 rupee to pay online.", "error");
          return;
        }
        await startMemberPayment({
          name: values.name, age: values.age ? Number(values.age) : undefined, gender: values.gender,
          phone: values.phone, email: values.email, planId: values.planId, amountPaid: amount,
          preferredShift: values.preferredShift, goal: values.goal,
        });
        return;
      }
      const result = await createMember(session.gymId, {
        name: values.name, age: values.age ? Number(values.age) : undefined, gender: values.gender,
        phone: values.phone, email: values.email, planId: values.planId, amountPaid: Number(values.amountPaid || 0),
        paymentMode: values.paymentMode, preferredShift: values.preferredShift, goal: values.goal,
      });
      invalidate();
      setShowAdd(false);
      reset();
      setCredentials({ ...result, name: values.name, phone: values.phone });
      notify(result.waitlisted ? "Member added and waitlisted (no trainer capacity)" : "Member added and assigned a trainer");
    } catch (err) {
      notify(err instanceof Error ? err.message : "We could not create the member.", "error");
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader
        title="Members"
        description="Search, filter and onboard new members."
        action={<Button onClick={() => setShowAdd(true)}><Plus size={16} /> Add member</Button>}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchField placeholder="Search members by name or ID" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex gap-2 overflow-x-auto">
          {(["all", "active", "waitlisted", "expired"] as const).map((key) => (
            <Chip key={key} active={statusFilter === key} onClick={() => setStatusFilter(key)}>
              {key === "all" ? "All" : key[0].toUpperCase() + key.slice(1)}
            </Chip>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No members found" description="Try a different search or filter, or add a new member." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-track text-[11px] uppercase tracking-wide text-text-secondary">
                <th className="px-5 py-3">Member</th>
                <th className="px-5 py-3">Trainer</th>
                <th className="px-5 py-3">Plan ends</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-track">
              {rows.map(({ member, user, trainer, sub, isActive }) => (
                <tr key={member.userId}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-thumb text-[11px] font-semibold">
                        {initials(user.name)}
                      </div>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-[11px] text-text-secondary">{user.publicId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-text-secondary">{trainer?.name ?? "Unassigned"}</td>
                  <td className="px-5 py-3 text-text-secondary">{sub ? formatDate(sub.endDate) : "-"}</td>
                  <td className="px-5 py-3">
                    {member.waitlisted ? (
                      <Badge tone="warning"><Clock size={11} className="mr-1 inline" />Waitlisted</Badge>
                    ) : (
                      <Badge tone={isActive ? "success" : "danger"}>{isActive ? "Active" : "Expired"}</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      aria-label={`Delete ${user.name}`}
                      className="rounded-full p-1.5 text-text-secondary hover:bg-black/5 hover:text-danger"
                      onClick={() => setToDelete({ id: user.userId, name: user.name })}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ConfirmDelete
        open={!!toDelete}
        title="Delete member"
        message={`Delete ${toDelete?.name ?? "this member"} permanently? Their profile, attendance, payments and ratings will be removed. This cannot be undone.`}
        confirmLabel="Delete member"
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deleteUser(toDelete.id);
            invalidate();
            notify("Member deleted");
            setToDelete(null);
          } catch (err) {
            notify(err instanceof Error ? err.message : "We could not delete this member.", "error");
          }
        }}
      />

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add member" width="max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input id="m-name" label="Full name" required error={errors.name?.message} {...register("name", { required: "Name is required" })} />
            <Input id="m-age" label="Age" type="number" min={10} max={100} {...register("age")} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select id="m-gender" label="Gender" {...register("gender")}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
            <Input id="m-phone" label="Phone" {...register("phone")} />
          </div>
          <Input id="m-email" label="Email" type="email" required error={errors.email?.message}
            {...register("email", { required: "Email is required", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" } })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              id="m-plan"
              label="Plan"
              required
              error={errors.planId?.message}
              {...register("planId", {
                required: "Choose a plan",
                onChange: (e) => {
                  const price = plans.find((p) => p.planId === e.target.value)?.price;
                  setValue("amountPaid", price != null ? String(price) : "");
                },
              })}
            >
              <option value="">Select a plan</option>
              {plans.map((p) => <option key={p.planId} value={p.planId}>{p.name} - {p.durationDays} days</option>)}
            </Select>
            <Input id="m-topay" label="Amount to pay" readOnly value={watchedPlanId ? formatCurrency(planPrice) : ""} placeholder="Choose a plan" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select id="m-mode" label="Payment mode" {...register("paymentMode")}>
              <option value="cash">Cash</option>
              <option value="upi">UPI / Card (pay online)</option>
            </Select>
            <Input id="m-amount" label="Amount paid" type="number" min={0} {...register("amountPaid")} />
          </div>
          <div className="grid gap-3">
            <Select id="m-shift" label="Preferred shift" {...register("preferredShift")}>
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
              <option value="full">No preference</option>
            </Select>
          </div>
          <Input id="m-goal" label="Goal" placeholder="e.g. weight loss and toning" {...register("goal")} />
          {payOnlineMode && (
            <p className="rounded-2xl bg-thumb px-4 py-3 text-[12px] leading-5 text-text-secondary">
              You will be taken to a secure Cashfree page to pay. The member is created as soon as the payment goes through.
            </p>
          )}
          <Button type="submit" fullWidth loading={isSubmitting}>
            {payOnlineMode ? "Pay online and create member" : "Create member"}
          </Button>
        </form>
      </Modal>

      <Modal open={!!credentials} onClose={() => setCredentials(null)} title="Member created">
        {credentials && <CredentialsPanel credentials={credentials} onClose={() => setCredentials(null)} />}
      </Modal>
    </div>
  );
}
