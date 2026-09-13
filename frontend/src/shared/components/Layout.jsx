// Applies the role palette (theme-lender / theme-borrower / theme-vault) and
// renders the top nav. Wrap every authenticated page in this.
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../store.jsx";
import { api } from "../api.js";
import DevnetBadge from "./DevnetBadge.jsx";
import Footer from "./Footer.jsx";
import Logo from "./Logo.jsx";

const THEME = { lender: "theme-lender", borrower: "theme-borrower", admin: "theme-vault" };
const TITLE = { lender: "CoinFish · Lend", borrower: "CoinFish · Borrow", admin: "CoinFish · Vault" };

const NAV = {
  lender: [
    ["/lender/deposit", "Deposit"],
    ["/lender/dashboard", "Dashboard"],
  ],
  borrower: [
    ["/borrower/collateral", "Collateral"],
    ["/borrower/borrow", "Borrow"],
    ["/borrower/dashboard", "Dashboard"],
  ],
  admin: [["/vault", "Vault"]],
};

export default function Layout({ role, children }) {
  const { account, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const links = NAV[role] || [];
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.runtimeStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  return (
    <div className={`app-bg ${THEME[role] || ""}`}>
      <header className="relative z-10 flex items-center justify-between gap-4 px-6 py-4 md:px-8">
        <div className="flex items-center gap-3 text-[1.05rem] font-semibold tracking-tight">
          <Logo size={44} to="/" />
          {TITLE[role] || "CoinFish"}
        </div>
        <nav className="flex flex-wrap items-center justify-end gap-1">
          {links.map(([to, label]) => {
            const on = loc.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className="app-nav-link"
                style={{
                  background: on ? "var(--accent)" : "transparent",
                  color: on ? "var(--accent-fg)" : "var(--fg-soft)",
                  borderColor: on ? "transparent" : "transparent",
                }}
              >
                {label}
              </Link>
            );
          })}
          <Link to="/" className="app-nav-link" style={{ color: "var(--fg-soft)" }}>
            Company
          </Link>
          {account && (
            <button
              type="button"
              onClick={() => { logout(); nav("/app"); }}
              className="app-nav-link ml-1"
              style={{ color: "var(--fg-soft)", background: "transparent", border: 0 }}
            >
              Sign out
            </button>
          )}
          <span className="ml-1 hidden sm:inline-flex">
            <DevnetBadge status={status} />
          </span>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8 md:px-8">{children}</main>
      <Footer />
    </div>
  );
}
