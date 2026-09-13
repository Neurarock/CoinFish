// Partner Portal mini-frontend — placeholder login + stub dashboard.
import { Navigate, Route, Routes } from "react-router-dom";
import PartnerLogin from "./PartnerLogin.jsx";
import PartnerHome from "./PartnerHome.jsx";
import { isPartnerAuthed } from "./session.js";
import "./partners.css";

function RequirePartner({ children }) {
  if (!isPartnerAuthed()) return <Navigate to="/partners" replace />;
  return children;
}

export default function PartnersMFE() {
  return (
    <Routes>
      <Route index element={<PartnerLogin />} />
      <Route
        path="home"
        element={
          <RequirePartner>
            <PartnerHome />
          </RequirePartner>
        }
      />
      <Route path="*" element={<Navigate to="/partners" replace />} />
    </Routes>
  );
}
