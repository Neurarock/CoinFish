// Applies the role palette (theme-lender / theme-borrower / theme-vault) and
// renders the top nav. Wrap every authenticated page in this.
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../store.jsx";
import { api } from "../api.js";
import DevnetBadge from "./DevnetBadge.jsx";
import Footer from "./Footer.jsx";

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
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-3"
        style={{ background: "var(--bg-soft)", borderBottom: "1px solid var(--line)" }}>
        <div className="flex items-center gap-2 font-extrabold text-lg">
          {role !== "admin" && <span className="text-2xl">🐟</span>}
          {TITLE[role] || "CoinFish"}
        </div>
        <nav className="flex items-center gap-1">
          {links.map(([to, label]) => (
            <Link key={to} to={to}
              className="rounded-full px-3 py-1.5 text-sm font-semibold"
              style={{
                background: loc.pathname === to ? "var(--accent)" : "transparent",
                color: loc.pathname === to ? "var(--accent-fg)" : "var(--fg-soft)",
              }}>
              {label}
            </Link>
          ))}
          {account && (
            <button onClick={() => { logout(); nav("/"); }}
              className="ml-2 rounded-full px-3 py-1.5 text-sm font-semibold"
              style={{ color: "var(--fg-soft)" }}>
              Sign out
            </button>
          )}
          <span className="ml-2 hidden sm:inline-flex">
            <DevnetBadge status={status} />
          </span>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      <Footer />
    </div>
  );
}
