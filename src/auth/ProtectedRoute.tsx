import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { UserRole } from "../types";

export function ProtectedRoute({ role }: { role: UserRole }) {
  const { session } = useAuth();

  if (!session) return <Navigate to="/" replace />;
  if (session.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (session.role !== role) return <Navigate to={`/${session.role}`} replace />;

  return <Outlet />;
}
