import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Plus, Copy, Check, UserX, UserCheck, MessageCircle, Trash2 } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useDb, useInvalidateDb } from "../../api/db";
import { PageHeader } from "../../components/layout/PageHeader";
import { SearchField } from "../../components/ui/SearchField";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Chip";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Input, Select } from "../../components/ui/Input";
import { EmptyState } from "../../components/ui/States";
import { useToast } from "../../components/ui/Toast";
import { createTrainer, deleteUser, setUserActive, recordSalaryPayment, type CreatedCredentials } from "../../lib/backend";
import { ConfirmDelete } from "../../components/ui/ConfirmDelete";
import { formatCurrency, initials } from "../../lib/format";

interface TrainerFormValues {
  name: string; age: string; gender: "male" | "female" | "other"; phone: string; email: string;
  salary: string; specialty: string; shift: "morning" | "evening" | "full"; maxCapacity: string;
}

export default function OwnerTrainers() {
  const { session } = useAuth();
  const { data: db } = useDb();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [credentials, setCredentials] = useState<CreatedCredentials | null>(null);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  const [salaryFor, setSalaryFor] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<TrainerFormValues>({
    defaultValues: { gender: "male", shift: "full", maxCapacity: "25" },
  });

  const trainers = useMemo(() => {
    if (!db || !session) return [];
    return db.trainers
      .filter((t) => t.gymId === session.gymId)
      .map((t) => {
        const user = db.users.find((u) => u.userId === t.userId)!;
        const members = db.members.filter((m) => m.assignedTrainerId === t.userId);
        const ratings = db.ratings.filter((r) => r.trainerId === t.userId);
        const avgRating = ratings.length ? ratings.reduce((s, r) => s + r.score, 0) / ratings.length : null;
        return { trainer: t, user, memberCount: members.length, avgRating };
      })
      .filter((row) => row.user.name.toLowerCase().includes(search.toLowerCase()) || row.user.publicId.toLowerCase().includes(search.toLowerCase()));
  }, [db, session, search]);

  async function onSubmit(values: TrainerFormValues) {
    if (!session) return;
    try {
      const result = await createTrainer(session.gymId, {
        name: values.name, age: values.age ? Number(values.age) : undefined, gender: values.gender,
        phone: values.phone, email: values.email, salary: Number(values.salary), specialty: values.specialty,
        shift: values.shift, maxCapacity: Number(values.maxCapacity),
      });
      invalidate();
      setShowAdd(false);
      reset();
      setCredentials({ ...result, name: values.name, phone: values.phone });
    } catch (err) {
      notify(err instanceof Error ? err.message : "We could not create the trainer.", "error");
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader
        title="Trainers"
        description="Manage your training staff, specialties and salaries."
        action={<Button onClick={() => setShowAdd(true)}><Plus size={16} /> Add trainer</Button>}
      />

      <SearchField placeholder="Search trainers by name or ID" value={search} onChange={(e) => setSearch(e.target.value)} />

      {trainers.length === 0 ? (
        <EmptyState title="No trainers yet" description="Add your first trainer to start assigning members automatically." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trainers.map(({ trainer, user, memberCount, avgRating }) => (
            <Card key={trainer.userId} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-thumb text-[13px] font-semibold">
                  {initials(user.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{user.name}</p>
                  <p className="text-[11px] text-text-secondary">{user.publicId} - {trainer.specialty}</p>
                </div>
                <Badge tone={user.isActive ? "success" : "danger"}>{user.isActive ? "Active" : "Inactive"}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-thumb py-2">
                  <p className="text-[14px] font-semibold">{memberCount}/{trainer.maxCapacity}</p>
                  <p className="text-[10px] text-text-secondary">members</p>
                </div>
                <div className="rounded-xl bg-thumb py-2">
                  <p className="text-[14px] font-semibold">{avgRating ? avgRating.toFixed(1) : "-"}</p>
                  <p className="text-[10px] text-text-secondary">rating</p>
                </div>
                <div className="rounded-xl bg-thumb py-2">
                  <p className="text-[14px] font-semibold capitalize">{trainer.shift}</p>
                  <p className="text-[10px] text-text-secondary">shift</p>
                </div>
              </div>
              <p className="text-[12px] text-text-secondary">Salary: {formatCurrency(trainer.salary)}/month</p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" fullWidth onClick={() => setSalaryFor(trainer.userId)}>
                  Record salary
                </Button>
                <Button
                  variant={user.isActive ? "danger" : "secondary"}
                  size="sm"
                  fullWidth
                  onClick={async () => {
                    await setUserActive(session!.gymId, user.userId, !user.isActive);
                    invalidate();
                    notify(user.isActive ? "Trainer deactivated" : "Trainer reactivated");
                  }}
                >
                  {user.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                  {user.isActive ? "Deactivate" : "Reactivate"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Delete ${user.name}`}
                  onClick={() => setToDelete({ id: user.userId, name: user.name })}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDelete
        open={!!toDelete}
        title="Delete trainer"
        message={`Delete ${toDelete?.name ?? "this trainer"} permanently? Their members will be moved to another trainer or waitlisted. This cannot be undone.`}
        confirmLabel="Delete trainer"
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deleteUser(toDelete.id);
            invalidate();
            notify("Trainer deleted");
            setToDelete(null);
          } catch (err) {
            notify(err instanceof Error ? err.message : "We could not delete this trainer.", "error");
          }
        }}
      />

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add trainer">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Input id="t-name" label="Full name" required error={errors.name?.message} {...register("name", { required: "Name is required" })} />
          <div className="grid grid-cols-2 gap-3">
            <Input id="t-age" label="Age" type="number" min={18} max={75} {...register("age")} />
            <Select id="t-gender" label="Gender" {...register("gender")}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <Input id="t-phone" label="Phone" {...register("phone")} />
          <Input id="t-email" label="Email" type="email" required error={errors.email?.message}
            {...register("email", { required: "Email is required", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" } })} />
          <div className="grid grid-cols-2 gap-3">
            <Input id="t-salary" label="Monthly salary" type="number" required error={errors.salary?.message} {...register("salary", { required: "Salary is required" })} />
            <Input id="t-capacity" label="Max members" type="number" {...register("maxCapacity")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input id="t-specialty" label="Specialty" placeholder="e.g. Strength Training" {...register("specialty")} />
            <Select id="t-shift" label="Shift" {...register("shift")}>
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
              <option value="full">Full day</option>
            </Select>
          </div>
          <Button type="submit" fullWidth loading={isSubmitting}>Create trainer</Button>
        </form>
      </Modal>

      <Modal open={!!credentials} onClose={() => setCredentials(null)} title="Trainer created">
        {credentials && <CredentialsPanel credentials={credentials} onClose={() => setCredentials(null)} />}
      </Modal>

      <Modal open={!!salaryFor} onClose={() => setSalaryFor(null)} title="Record salary payment">
        {salaryFor && session && (
          <SalaryForm
            trainerId={salaryFor}
            onSave={async (month, amount) => {
              try {
                await recordSalaryPayment(session.gymId, salaryFor, month, amount);
                invalidate();
                notify("Salary recorded");
                setSalaryFor(null);
              } catch (err) {
                notify(err instanceof Error ? err.message : "Could not record this payment.", "error");
              }
            }}
            onCancel={() => setSalaryFor(null)}
          />
        )}
      </Modal>
    </div>
  );
}

// Phone numbers typed without a country code get this one (India).
const DEFAULT_COUNTRY_CODE = "91";

function whatsappNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length < 10) return null;
  return digits.length === 10 ? DEFAULT_COUNTRY_CODE + digits : digits;
}

export function CredentialsPanel({ credentials, onClose }: { credentials: CreatedCredentials; onClose: () => void }) {
  const { session } = useAuth();
  const { data: db } = useDb();
  const [copied, setCopied] = useState(false);

  const gym = db?.gyms.find((g) => g.gymId === session?.gymId);
  // Opens the login page with the gym code and ID already filled in.
  const loginLink = gym
    ? `${window.location.origin}${window.location.pathname}#/?gym=${encodeURIComponent(gym.gymId)}&id=${encodeURIComponent(credentials.publicId)}`
    : "";
  const message =
    `Hi ${credentials.name ?? ""}, welcome to ${gym?.name ?? "the gym"}!\n\n` +
    `Log in here: ${loginLink}\n` +
    `ID: ${credentials.publicId}\n` +
    `Temporary password: ${credentials.temporaryPassword}\n\n` +
    `The password works for ${credentials.expiresInHours} hours. You will be asked to choose a new one.`;
  const waNumber = credentials.phone ? whatsappNumber(credentials.phone) : null;

  function copy() {
    navigator.clipboard?.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-text-secondary">
        Email delivery is not configured for this gym yet, so share these details directly. The temporary password expires in {credentials.expiresInHours} hours.
      </p>
      <div className="rounded-2xl bg-ink p-4 text-on-ink">
        <p className="text-[11px] text-white/60">User ID</p>
        <p className="mb-2 text-[16px] font-semibold">{credentials.publicId}</p>
        <p className="text-[11px] text-white/60">Temporary password</p>
        <p className="text-[16px] font-semibold tracking-wide">{credentials.temporaryPassword}</p>
      </div>
      {waNumber ? (
        <a
          href={`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-[14px] font-medium text-white"
        >
          <MessageCircle size={16} /> Send via WhatsApp
        </a>
      ) : (
        <p className="text-[12px] text-text-secondary">Add a 10-digit phone number to send these details on WhatsApp.</p>
      )}
      <Button variant="secondary" fullWidth onClick={copy}>
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? "Copied" : "Copy details"}
      </Button>
      <Button fullWidth onClick={onClose}>Done</Button>
    </div>
  );
}

function SalaryForm({ onSave, onCancel }: { trainerId: string; onSave: (month: string, amount: number) => void; onCancel: () => void }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [amount, setAmount] = useState("");
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(`${month}-01`, Number(amount));
      }}
    >
      <Input id="s-month" label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      <Input id="s-amount" label="Amount" type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} />
      <div className="flex gap-2">
        <Button type="button" variant="secondary" fullWidth onClick={onCancel}>Cancel</Button>
        <Button type="submit" fullWidth>Save</Button>
      </div>
    </form>
  );
}
