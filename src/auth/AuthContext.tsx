import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as backend from "../lib/backend";
import type { Session } from "../types";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  error: string | null;
  login: (gymId: string, identifier: string, password: string) => Promise<Session>;
  switchGym: (gymId: string) => Promise<Session>;
  createGym: (name: string, address: string) => Promise<Session>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  refreshSession: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => backend.getSession());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restores the Supabase sign-in on start (also completes a Google sign-in redirect).
  useEffect(() => {
    let active = true;
    backend.restoreSession().then((restored) => {
      if (active) setSession(restored);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const login = useCallback(async (gymId: string, identifier: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await backend.login({ gymId, identifier, password });
      setSession(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Incorrect ID or password";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setError(null);
    try {
      await backend.startGoogleSignIn();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      setError(message);
      throw err;
    }
  }, []);

  const switchGym = useCallback(async (gymId: string) => {
    const next = await backend.switchGym(gymId);
    setSession(next);
    return next;
  }, []);

  const createGym = useCallback(async (name: string, address: string) => {
    const next = await backend.createGym(name, address);
    setSession(next);
    return next;
  }, []);

  const logout = useCallback(() => {
    backend.logout();
    setSession(null);
  }, []);

  const refreshSession = useCallback(() => {
    setSession(backend.getSession());
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({ session, loading, error, login, loginWithGoogle, switchGym, createGym, logout, refreshSession, clearError }),
    [session, loading, error, login, loginWithGoogle, switchGym, createGym, logout, refreshSession, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
