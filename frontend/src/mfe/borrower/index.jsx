import { Route, Routes } from "react-router-dom";
import Account from "../../shared/components/Account.jsx";
import Collateral from "./Collateral.jsx";
import Borrow from "./Borrow.jsx";
import Dashboard from "./Dashboard.jsx";

export default function BorrowerMFE() {
  return (
    <Routes>
      <Route path="collateral" element={<Collateral />} />
      <Route path="borrow" element={<Borrow />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="account" element={<Account role="borrower" />} />
    </Routes>
  );
}
