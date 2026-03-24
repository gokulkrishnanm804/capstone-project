import { Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function ProtectedRoute({
  children,
  requiredRole,
  blockedRoles,
  redirectTo,
}) {
  const { isAuthenticated, user } = useAuth();
  const roleFallback = user?.role === "admin" ? "/admin" : "/analyst/cases";
  const unauthorizedTarget = redirectTo || roleFallback;

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (blockedRoles && blockedRoles.includes(user?.role)) {
    return <Navigate to={unauthorizedTarget} replace />;
  }
  if (
    requiredRole &&
    (Array.isArray(requiredRole)
      ? !requiredRole.includes(user?.role)
      : user?.role !== requiredRole)
  )
    return <Navigate to={unauthorizedTarget} replace />;
  return children;
}
