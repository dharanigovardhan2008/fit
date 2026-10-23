import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Dumbbell } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { listPublicGyms } from "../../lib/backend";
import type { GymOption } from "../../types";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Dropdown } from "../../components/ui/Dropdown";

// Minimal inline Google "G" SVG — no external dependency
function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function readSaved(key: string): string {
  try { return localStorage.getItem(key) ?? ""; } catch { return ""; }
}

// A failed Google sign-in comes back as a page reload, so the message waits in sessionStorage.
function takeAuthError(): string | null {
  try {
    const msg = sessionStorage.getItem("gymsphere.loginError");
    if (msg) sessionStorage.removeItem("gymsphere.loginError");
    return msg;
  } catch { return null; }
}

export default function LoginPage() {
  const { session, login, loginWithGoogle, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // A link from the owner (#/?id=M2601) fills this in. Otherwise remember the last one used.
  const [identifier, setIdentifier] = useState(() => params.get("id") ?? readSaved("gymsphere.lastId"));
  const [gyms, setGyms] = useState<GymOption[]>([]);
  const [gymId, setGymId] = useState(() => params.get("gym") ?? readSaved("gymsphere.lastGymId"));
  const [gymsLoaded, setGymsLoaded] = useState(false);

  // The gym list is read fresh every time, so a gym renamed or added by an owner shows up here.
  useEffect(() => {
    listPublicGyms()
      .then((list) => {
        setGyms(list);
        setGymId((current) => (list.some((g) => g.gymId === current) ? current : list.length === 1 ? list[0].gymId : ""));
      })
      .catch(() => undefined)
      .finally(() => setGymsLoaded(true));
  }, []);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() => takeAuthError());

  // Already signed in: go straight to the dashboard.
  useEffect(() => {
    if (session && !session.mustChangePassword) navigate(`/${session.role}`, { replace: true });
  }, [session, navigate]);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const session = await login(gymId, identifier, password);
      try {
        localStorage.setItem("gymsphere.lastId", identifier.trim());
        localStorage.setItem("gymsphere.lastGymId", gymId);
      } catch { /* storage unavailable */ }
      if (session.mustChangePassword) {
        navigate("/change-password", { replace: true });
        return;
      }
      navigate(`/${session.role}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect ID or password");
    }
  }

  async function onGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);
    try {
      // Redirects to Google, then back to the app signed in.
      await loginWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col px-6 pb-10 pt-6 sm:pt-10">
      <div
        className="relative mb-8 flex h-[220px] w-full flex-col justify-end overflow-hidden rounded-[24px] bg-ink-deep p-6 sm:h-[260px]"
        style={{ backgroundImage: "linear-gradient(180deg, rgba(11,11,11,1) 55%, rgba(248,248,248,1) 100%)" }}
      >
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-[40px] border border-white/10" aria-hidden="true" />
        <div className="absolute left-10 top-8 h-20 w-20 rotate-12 rounded-[24px] bg-white/5" aria-hidden="true" />
        <div className="relative flex items-center gap-2 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <Dumbbell size={18} />
          </span>
          <span className="text-[16px] font-semibold">GymSphere</span>
        </div>
      </div>

      <h1 className="mb-1 text-[28px] font-semibold leading-[40px] text-text-primary">Welcome back</h1>
      <p className="mb-8 text-[13px] leading-5 text-text-secondary">
        Pick your gym, then sign in with your ID, email or mobile number.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Dropdown
          id="gym"
          label="Gym"
          required
          value={gymId}
          onChange={setGymId}
          placeholder={gymsLoaded && gyms.length === 0 ? "No gyms yet. Register your gym below" : "Select your gym"}
          options={gyms.map((g) => ({ value: g.gymId, label: g.name }))}
        />
        <Input
          id="identifier"
          label="ID, email or mobile number"
          required
          autoComplete="username"
          placeholder="e.g. M2601, you@example.com or 9876543210"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <Input
          id="password"
          label="Password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-[13px] text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" fullWidth loading={loading} disabled={!gymId || !identifier.trim() || !password}>
          Login
        </Button>
      </form>

      {/* "or" divider */}
      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-track" />
        <span className="text-[12px] text-text-secondary">or</span>
        <span className="h-px flex-1 bg-track" />
      </div>

      {/* Google sign-in button — 327×60, radius 18, card shadow, white */}
      <button
        type="button"
        onClick={onGoogleSignIn}
        disabled={googleLoading || loading}
        className="flex h-[60px] w-full max-w-[327px] self-center items-center justify-center gap-3 rounded-[18px] border border-track bg-white text-[14px] font-medium text-text-primary shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition-all hover:border-ink/20 hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <GoogleLogo />
        {googleLoading ? "Signing in..." : "Continue with Google"}
      </button>

      <div className="mt-6 flex flex-col items-center gap-2 text-[13px]">
        <Link to="/forgot-password" className="text-text-secondary underline-offset-2 hover:underline">
          Forgot password
        </Link>
        <p className="text-text-secondary">
          New gym?{" "}
          <Link to="/register" className="font-medium text-text-primary underline-offset-2 hover:underline">
            Register your gym
          </Link>
        </p>
      </div>
    </div>
  );
}
