// Borrower mini-frontend — collateral, borrow quote, and loan dashboard.
import { Route, Routes } from "react-router-dom";
import Collateral from "./Collateral.jsx";
import Borrow from "./Borrow.jsx";
import Dashboard from "./Dashboard.jsx";

export default function BorrowerMFE() {
  return (
    <Routes>
      <Route path="collateral" element={<Collateral />} />
      <Route path="borrow" element={<Borrow />} />
      <Route path="dashboard" element={<Dashboard />} />
    </Routes>
  );
}
