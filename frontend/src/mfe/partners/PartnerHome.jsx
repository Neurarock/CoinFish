// Partner Portal home — coming-soon API keys/usage + shared password change.
import { Link, useNavigate } from "react-router-dom";
import Logo from "../../shared/components/Logo.jsx";
import ChangePasswordForm from "../../shared/components/ChangePasswordForm.jsx";
import { neonAuthEnabled } from "../../shared/neonAuth.js";
import { clearPartnerSession, getPartnerSession } from "./session.js";

export default function PartnerHome() {
  const nav = useNavigate();
  const session = getPartnerSession() || {};

  function signOut() {
    clearPartnerSession();
    nav("/partners");
  }

  return (
    <div className="partners-page">
      <header className="partners-nav">
        <Link to="/" className="partners-brand">
          <Logo size={40} aura={false} />
          <span>CoinFish</span>
        </Link>
        <nav className="partners-nav-links">
          <Link to="/app">Launch App</Link>
          <button type="button" className="partners-text-btn" onClick={signOut}>
            Sign out
          </button>
        </nav>
      </header>

      <main className="partners-home">
        <p className="partners-kicker">Portal</p>
        <h1>Welcome back</h1>
        <p className="partners-lede">
          Signed in as <strong>{session.email || "partner"}</strong>
          {session.org_id ? <> · org <code>{session.org_id}</code></> : null}
        </p>

        <div className="partners-grid">
          <section className="partners-tile">
            <h2>API credentials</h2>
            <p>Keys and secrets will appear here once partner onboarding goes live.</p>
            <div className="partners-placeholder-row">
              <span>API key</span>
              <code>••••••••••••••••</code>
            </div>
            <div className="partners-placeholder-row">
              <span>API secret</span>
              <code>••••••••••••••••</code>
            </div>
            <p className="partners-badge">Coming soon</p>
          </section>

          <section className="partners-tile">
            <h2>Usage</h2>
            <p>Volume, request counts, and commission tracking — empty until production.</p>
            <div className="partners-empty">No usage data in this demo.</div>
            <p className="partners-badge">Coming soon</p>
          </section>

          <section className="partners-tile partners-tile-span">
            <h2>Change password</h2>
            <p>
              {neonAuthEnabled
                ? "Updates Neon Auth. The same password signs you into lender, borrower, and partner."
                : "Updates the company account password used by lender, borrower, and partner."}
            </p>
            <ChangePasswordForm variant="partners" />
          </section>
        </div>

        <div className="partners-home-actions">
          <Link to="/" className="partners-btn partners-btn-ghost">
            Company site
          </Link>
          <Link to="/app" className="partners-btn partners-btn-primary">
            Launch App
          </Link>
        </div>
      </main>
    </div>
  );
}
