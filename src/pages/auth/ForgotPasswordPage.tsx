import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../../lib/backend";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    await requestPasswordReset(email);
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center px-6 py-10">
      <h1 className="mb-1 text-[22px] font-semibold leading-[30px] text-text-primary">Reset your password</h1>
      <p className="mb-6 text-[13px] leading-5 text-text-secondary">
        Enter the email on file for your account. We will send a secure link to reset your password.
      </p>
      {sent ? (
        <div className="rounded-2xl bg-success/10 px-4 py-4 text-[13px] text-success">
          If that email is registered, a reset link is on its way.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Input id="email" label="Email" type="email" required placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" size="lg" fullWidth loading={loading}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-[13px] text-text-secondary">
        <Link to="/" className="font-medium text-text-primary underline-offset-2 hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
