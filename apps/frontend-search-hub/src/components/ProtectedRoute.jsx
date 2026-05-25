import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store";

export default function ProtectedRoute({ children, roles }) {
  const { user } = useAuthStore();
  const loc = useLocation();
  if (!user) return <Navigate to={`/login?next=${loc.pathname}`} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
