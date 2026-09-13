// Shell host — composes CoinFish mini-frontends behind one router.
import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Guard from "./Guard.jsx";
import { CookieConsent } from "../shared/consent/index.js";

const LandingMFE = lazy(() => import("../mfe/landing/index.jsx"));
const AuthMFE = lazy(() => import("../mfe/auth/index.jsx"));
const PartnersMFE = lazy(() => import("../mfe/partners/index.jsx"));
const LenderMFE = lazy(() => import("../mfe/lender/index.jsx"));
const BorrowerMFE = lazy(() => import("../mfe/borrower/index.jsx"));
const VaultMFE = lazy(() => import("../mfe/vault/index.jsx"));

function MfeFallback() {
  return (
    <div className="app-bg flex min-h-screen items-center justify-center"
      style={{
        background: "#061018",
        color: "#a1a1a6",
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
      }}>
      <div className="text-sm font-medium tracking-tight">Loading CoinFish…</div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Suspense fallback={<MfeFallback />}>
        <Routes>
          <Route path="/" element={<LandingMFE />} />
          <Route path="/app" element={<AuthMFE />} />
          <Route path="/partners/*" element={<PartnersMFE />} />

          <Route path="/lender/*" element={<Guard role="lender"><LenderMFE /></Guard>} />
          <Route path="/borrower/*" element={<Guard role="borrower"><BorrowerMFE /></Guard>} />

          {/* Vault dashboard is open in the demo (no admin login). */}
          <Route path="/vault" element={<VaultMFE />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <CookieConsent />
    </>
  );
}
