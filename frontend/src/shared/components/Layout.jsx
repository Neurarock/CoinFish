// Applies the role palette (theme-lender / theme-borrower / theme-vault) and
// renders the top nav. Wrap every authenticated page in this.
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store.jsx";
import DevnetBadge from "./DevnetBadge.jsx";
import Logo from "./Logo.jsx";
import { hasAccess } from "../access.js";

const THEME = { lender: "theme-lender", borrower: "theme-borrower", admin: "theme-vault" };

function NodesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="app-vault-badge-icon">
      <path
        fill="currentColor"
        d="M16.5 12a3.5 3.5 0 1 0-3.4-4.3L9.7 9.9a3.5 3.5 0 1 0 0 4.2l3.4 2.2a3.5 3.5 0 1 0 .9-1.5l-3.4-2.2a3.6 3.6 0 0 0 0-1.2l3.4-2.2c.4.3.9.5 1.5.5Zm-9 1.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm9-6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"
      />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="app-vault-badge-icon">
      <path
        fill="currentColor"
        d="M4.25 3.5h6.5A1.75 1.75 0 0 1 12.5 5.25v4.5A1.75 1.75 0 0 1 10.75 11.5h-6.5A1.75 1.75 0 0 1 2.5 9.75v-4.5A1.75 1.75 0 0 1 4.25 3.5Zm9 0h6.5A1.75 1.75 0 0 1 21.5 5.25v2A1.75 1.75 0 0 1 19.75 9h-6.5A1.75 1.75 0 0 1 11.5 7.25v-2A1.75 1.75 0 0 1 13.25 3.5Zm0 8h6.5A1.75 1.75 0 0 1 21.5 13.25v5.5a1.75 1.75 0 0 1-1.75 1.75h-6.5a1.75 1.75 0 0 1-1.75-1.75v-5.5A1.75 1.75 0 0 1 13.25 11.5Zm-9 3h6.5A1.75 1.75 0 0 1 12.5 16.25v2.5A1.75 1.75 0 0 1 10.75 20.5h-6.5A1.75 1.75 0 0 1 2.5 18.75v-2.5A1.75 1.75 0 0 1 4.25 14.5Z"
      />
    </svg>
  );
}

function CollateralIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="app-vault-badge-icon">
      <path
        fill="currentColor"
        d="M12 2.5 4.75 5.6v5.4c0 4.55 3.12 8.72 7.25 9.75 4.13-1.03 7.25-5.2 7.25-9.75V5.6L12 2.5Zm0 3.1 5.25 2.24v3.16c0 3.2-2.12 6.2-5.25 7.22-3.13-1.02-5.25-4.02-5.25-7.22V7.84L12 5.6Z"
      />
    </svg>
  );
}

function BorrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="app-vault-badge-icon">
      <path
        fill="currentColor"
        d="M12 3.25a.75.75 0 0 1 .75.75v9.19l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 1.06-1.06l2.72 2.72V4a.75.75 0 0 1 .75-.75ZM5.75 16.5A1.75 1.75 0 0 0 4 18.25v.5c0 .97.78 1.75 1.75 1.75h12.5A1.75 1.75 0 0 0 20 18.75v-.5a1.75 1.75 0 0 0-1.75-1.75h-2.1a.75.75 0 0 0 0 1.5h2.1a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25H5.75a.25.25 0 0 1-.25-.25v-.5a.25.25 0 0 1 .25-.25h2.1a.75.75 0 0 0 0-1.5h-2.1Z"
      />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="app-vault-badge-icon">
      <path
        fill="currentColor"
        d="M5 3.75A1.75 1.75 0 0 0 3.25 5.5v13A1.75 1.75 0 0 0 5 20.25h6.5a.75.75 0 0 0 0-1.5H5a.25.25 0 0 1-.25-.25v-13A.25.25 0 0 1 5 5.25h6.5a.75.75 0 0 0 0-1.5H5Zm10.53 4.22a.75.75 0 1 0-1.06 1.06L16.94 11.5H9.75a.75.75 0 0 0 0 1.5h7.19l-2.47 2.47a.75.75 0 1 0 1.06 1.06l3.75-3.75a.75.75 0 0 0 0-1.06l-3.75-3.75Z"
      />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="app-vault-badge-icon">
      <path
        fill="currentColor"
        d="M12 3.75a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 1.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM6.25 19.5a5.75 5.75 0 0 1 11.5 0 .75.75 0 0 1-1.5 0 4.25 4.25 0 0 0-8.5 0 .75.75 0 0 1-1.5 0Z"
      />
    </svg>
  );
}

const BORROWER_NAV = [
  ["/borrower/collateral", "Collateral", CollateralIcon],
  ["/borrower/borrow", "Borrow", BorrowIcon],
  ["/borrower/dashboard", "Dashboard", DashboardIcon],
];

function NavBadge({ to, onClick, className = "app-vault-badge", icon, arrow = true, current = false, children }) {
  const inner = (
    <>
      {icon}
      {children}
      {arrow ? <span aria-hidden="true" className="app-vault-badge-arrow">↗</span> : null}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={className} aria-current={current ? "page" : undefined}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

export default function Layout({ role, children }) {
  const { account, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();

  return (
    <div className={`app-bg ${THEME[role] || ""}`}>
      <header className="relative z-10 flex items-center justify-between gap-4 px-6 py-4 md:px-8">
        <div className="flex items-center gap-3 text-[1.05rem] font-semibold tracking-tight">
          <Logo size={44} to="/" />
          <span>CoinFish</span>
        </div>
        <nav className="flex flex-wrap items-center justify-end gap-2">
          {role === "lender" && (
            <>
              {hasAccess(account, "borrower") && (
                <NavBadge to="/borrower/collateral" icon={<NodesIcon />}>
                  Borrow
                </NavBadge>
              )}
              <NavBadge to="/lender/dashboard" icon={<DashboardIcon />}>
                Dashboard
              </NavBadge>
              {account && (
                <NavBadge
                  to="/lender/account"
                  icon={<AccountIcon />}
                  current={loc.pathname === "/lender/account"}
                >
                  Account
                </NavBadge>
              )}
              {account && (
                <NavBadge
                  icon={<SignOutIcon />}
                  onClick={() => { logout(); nav("/app"); }}
                >
                  Sign out
                </NavBadge>
              )}
            </>
          )}
          {role === "admin" && (
            <>
              <NavBadge to="/partners" icon={<NodesIcon />}>
                Partner Portal
              </NavBadge>
              <NavBadge to="/app" className="app-vault-badge app-vault-badge-launch" arrow>
                Launch App
              </NavBadge>
            </>
          )}
          {role === "borrower" && (
            <>
              {hasAccess(account, "lender") && (
                <NavBadge to="/lender/deposit" icon={<NodesIcon />}>
                  Lend
                </NavBadge>
              )}
              {BORROWER_NAV.map(([to, label, Icon]) => (
                <NavBadge
                  key={to}
                  to={to}
                  icon={<Icon />}
                  current={loc.pathname === to}
                >
                  {label}
                </NavBadge>
              ))}
              {account && (
                <NavBadge
                  to="/borrower/account"
                  icon={<AccountIcon />}
                  current={loc.pathname === "/borrower/account"}
                >
                  Account
                </NavBadge>
              )}
              {account && (
                <NavBadge
                  icon={<SignOutIcon />}
                  onClick={() => { logout(); nav("/app"); }}
                >
                  Sign out
                </NavBadge>
              )}
              <span className="hidden sm:inline-flex">
                <DevnetBadge />
              </span>
            </>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8 md:px-8">{children}</main>
    </div>
  );
}
