// Lender mini-frontend — deposit & yield dashboard.
import { Route, Routes } from "react-router-dom";
import Deposit from "./Deposit.jsx";
import Dashboard from "./Dashboard.jsx";

export default function LenderMFE() {
  return (
    <Routes>
      <Route path="deposit" element={<Deposit />} />
      <Route path="dashboard" element={<Dashboard />} />
    </Routes>
  );
}
