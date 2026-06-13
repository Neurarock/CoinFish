import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./store.jsx";
import Landing from "./pages/Landing.jsx";
import LenderDeposit from "./pages/LenderDeposit.jsx";
import LenderDashboard from "./pages/LenderDashboard.jsx";
import BorrowerCollateral from "./pages/BorrowerCollateral.jsx";
import BorrowerBorrow from "./pages/BorrowerBorrow.jsx";
import BorrowerDashboard from "./pages/BorrowerDashboard.jsx";
import VaultDashboard from "./pages/VaultDashboard.jsx";

// Gate a route by role; bounce to the landing page if not signed in.
function Guard({ role, children }) {
  const { account } = useAuth();
  if (!account) return <Navigate to="/" replace />;
  if (role && account.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route path="/lender/deposit" element={<Guard role="lender"><LenderDeposit /></Guard>} />
      <Route path="/lender/dashboard" element={<Guard role="lender"><LenderDashboard /></Guard>} />

      <Route path="/borrower/collateral" element={<Guard role="borrower"><BorrowerCollateral /></Guard>} />
      <Route path="/borrower/borrow" element={<Guard role="borrower"><BorrowerBorrow /></Guard>} />
      <Route path="/borrower/dashboard" element={<Guard role="borrower"><BorrowerDashboard /></Guard>} />

      {/* The CoinFish vault dashboard is open in the demo (no admin login). */}
      <Route path="/vault" element={<VaultDashboard />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
