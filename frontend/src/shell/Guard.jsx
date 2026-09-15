import { Navigate } from "react-router-dom";
import { useAuth } from "../shared/store.jsx";
import { hasAccess } from "../shared/access.js";

// Gate a route by product access; bounce to the auth app if not signed in
// or if this company has not enabled that surface yet.
export default function Guard({ role, children }) {
  const { account } = useAuth();
  if (!account) return <Navigate to="/app" replace />;
  if (role && !hasAccess(account, role)) return <Navigate to="/app" replace />;
  return children;
}
