import { Navigate } from "react-router-dom";
import { useAuth } from "../shared/store.jsx";

// Gate a route by role; bounce to the auth app if not signed in.
export default function Guard({ role, children }) {
  const { account } = useAuth();
  if (!account) return <Navigate to="/app" replace />;
  if (role && account.role !== role) return <Navigate to="/app" replace />;
  return children;
}
