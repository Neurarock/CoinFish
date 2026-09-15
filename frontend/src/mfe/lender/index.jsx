import { Route, Routes } from "react-router-dom";
import Account from "../../shared/components/Account.jsx";
import Deposit from "./Deposit.jsx";
import Dashboard from "./Dashboard.jsx";

export default function LenderMFE() {
  return (
    <Routes>
      <Route path="deposit" element={<Deposit />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="account" element={<Account role="lender" />} />
    </Routes>
  );
}
