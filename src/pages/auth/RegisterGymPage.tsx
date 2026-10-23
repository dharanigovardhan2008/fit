import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { Check, Copy, Dumbbell } from "lucide-react";
import { registerGym } from "../../lib/backend";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useToast } from "../../components/ui/Toast";

interface FormValues {
  gymName: string;
  address: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerPassword: string;
  confirmPassword: string;
}

export default function RegisterGymPage() {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormValues>();
  const [result, setResult] = useState<{ gymCode: string; ownerId: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const { notify } = useToast();
  const navigate = useNavigate();
  const password = watch("ownerPassword");

  async function onSubmit(values: FormValues) {
    try {
      const outcome = await registerGym({
        gymName: values.gymName, address: values.address, ownerName: values.ownerName,
        ownerEmail: values.ownerEmail, ownerPassword: values.ownerPassword, ownerPhone: values.ownerPhone,
      });
      setResult(outcome);
    } catch (err) {
      notify(err instanceof Error ? err.message : "We could not complete registration.", "error");
    }
  }

  function copyPanel() {
    if (!result) return;
    navigator.clipboard?.writeText(`Gym code: ${result.gymCode}\nOwner ID: ${result.ownerId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (result) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col justify-center px-6 py-10">
        <div className="rounded-[24px] bg-ink p-7 text-on-ink shadow-dark-button">
          <p className="text-[13px] text-white/60">Your gym is ready</p>
          <h1 className="mt-1 text-[22px] font-semibold">Save these details</h1>
          <p className="mt-2 text-[13px] leading-5 text-white/70">
            Share the gym code with your team. Use the owner ID and the password you just created to log in.
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-[11px] text-white/60">Gym code</p>
              <p className="text-[18px] font-semibold tracking-wide">{result.gymCode}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-[11px] text-white/60">Owner ID</p>
              <p className="text-[18px] font-semibold tracking-wide">{result.ownerId}</p>
            </div>
          </div>
          <Button variant="secondary" fullWidth className="mt-5 bg-white/10 text-white border-white/20 hover:border-white/40" onClick={copyPanel}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied" : "Copy details"}
          </Button>
        </div>
        <Button className="mt-6" fullWidth size="lg" onClick={() => navigate("/")}>
          Continue to login
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col px-6 pb-12 pt-10">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-on-ink">
          <Dumbbell size={18} />
        </span>
        <span className="text-[16px] font-semibold">GymSphere</span>
      </div>
      <h1 className="mb-1 text-[28px] font-semibold leading-[40px] text-text-primary">Register your gym</h1>
      <p className="mb-6 text-[13px] leading-5 text-text-secondary">
        This creates your gym, your owner account and three default membership plans.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Input id="gymName" label="Gym name" required placeholder="Ironclad Fitness"
          error={errors.gymName?.message}
          {...register("gymName", { required: "Gym name is required" })} />
        <Input id="address" label="Address" placeholder="Street, city"
          {...register("address")} />
        <Input id="ownerName" label="Your full name" required placeholder="Owner name"
          error={errors.ownerName?.message}
          {...register("ownerName", { required: "Your name is required" })} />
        <Input id="ownerPhone" label="Phone" placeholder="10-digit phone number"
          {...register("ownerPhone")} />
        <Input id="ownerEmail" label="Your email" type="email" required placeholder="you@example.com"
          error={errors.ownerEmail?.message}
          {...register("ownerEmail", {
            required: "Email is required",
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email address" },
          })} />
        <Input id="ownerPassword" label="Password" type="password" required placeholder="At least 8 characters"
          error={errors.ownerPassword?.message}
          {...register("ownerPassword", { required: "Password is required", minLength: { value: 8, message: "Use at least 8 characters" } })} />
        <Input id="confirmPassword" label="Confirm password" type="password" required placeholder="Re-enter your password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword", {
            required: "Please confirm your password",
            validate: (value) => value === password || "Passwords do not match",
          })} />

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Create gym
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-text-secondary">
        Already registered?{" "}
        <Link to="/" className="font-medium text-text-primary underline-offset-2 hover:underline">
          Login
        </Link>
      </p>
    </div>
  );
}