import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { changePassword } from "../../lib/backend";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useToast } from "../../components/ui/Toast";

export default function ChangePasswordPage() {
  const { session, refreshSession } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!session) return;
    setSaving(true);
    try {
      await changePassword(session.userId, password);
      refreshSession();
      notify("Password updated");
      navigate(`/${session.role}`, { replace: true });
    } catch {
      setError("We could not update your password. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center px-6 py-10">
      <h1 className="mb-1 text-[22px] font-semibold leading-[30px] text-text-primary">Set a new password</h1>
      <p className="mb-6 text-[13px] leading-5 text-text-secondary">
        For your security, you must set a new password before continuing. Temporary passwords expire after 48 hours.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input id="newPassword" label="New password" type="password" required placeholder="At least 8 characters"
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <Input id="confirmPassword" label="Confirm new password" type="password" required placeholder="Re-enter password"
          value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-[13px] text-danger">{error}</p>}
        <Button type="submit" size="lg" fullWidth loading={saving}>
          Save and continue
        </Button>
      </form>
    </div>
  );
}
