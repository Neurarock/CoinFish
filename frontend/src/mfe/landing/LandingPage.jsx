// Professional company landing mini-frontend — trust-first marketing surface
// with cursor water ripples. Product auth lives at /app.
import { Link } from "react-router-dom";
import Logo from "../../shared/components/Logo.jsx";
import WaterRipple from "./WaterRipple.jsx";
import "./landing.css";

export default function LandingPage() {
  return (
    <div className="landing-page">
      <WaterRipple />

      <header className="landing-nav">
        <Link to="/" className="landing-brand">
          <Logo size={52} aura={false} />
          <span>CoinFish</span>
        </Link>
        <nav className="landing-nav-links">
          <a href="#company">Company</a>
          <a href="#trust">Trust</a>
          <a href="#terms">Terms</a>
          <Link to="/vault">Vault</Link>
          <Link to="/app" className="landing-nav-cta">Enter platform</Link>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <p className="landing-kicker">Liquidity infrastructure on the XRP Ledger</p>
          <h1 className="landing-brand-hero">CoinFish</h1>
          <p className="landing-lede">
            Institutional-grade fiat collateral meets on-chain RLUSD liquidity —
            built for lenders, borrowers, and operators who need clarity under the surface.
          </p>
          <div className="landing-cta-row">
            <Link to="/app" className="landing-btn landing-btn-primary">
              Enter the platform
            </Link>
            <a href="#company" className="landing-btn landing-btn-ghost">
              Company details
            </a>
          </div>
        </section>

        <section id="company" className="landing-section">
          <h2>Company</h2>
          <p className="landing-section-lede">
            CoinFish is being built by Team 5 for UK Finnovator · Ripple Track 2026.
          </p>
          <div className="landing-detail-grid">
            <Detail label="Legal name" value="CoinFish Ltd (working title)" />
            <Detail label="Jurisdiction" value="United Kingdom — registration under way" />
            <Detail label="Company number" value="To be confirmed" />
            <Detail label="Registered office" value="Address forthcoming" />
            <Detail label="Contact" value="hello@coinfish.finance (placeholder)" />
            <Detail label="Status" value="Demonstration build — not live financial services" />
          </div>
          <p className="landing-note">
            Company particulars, filings, and regulated permissions are under construction.
            Nothing on this site constitutes an offer of securities or regulated credit.
          </p>
        </section>

        <section id="product" className="landing-section">
          <h2>What we are building</h2>
          <p className="landing-section-lede">
            Three coordinated surfaces over one risk engine — each shipped here as its own mini-frontend.
          </p>
          <ul className="landing-product-list">
            <li>
              <strong>Lender world</strong>
              <span>Risk-tiered RLUSD pools, transparent utilisation, and an exit queue you can see.</span>
            </li>
            <li>
              <strong>Borrower world</strong>
              <span>Fiat collateral off-chain, live quotes, and instant Devnet drawdowns on-ledger.</span>
            </li>
            <li>
              <strong>CoinFish vault</strong>
              <span>Operator control room for fees, solvency, and loans in grace.</span>
            </li>
          </ul>
        </section>

        <section id="trust" className="landing-section">
          <h2>Trust &amp; compliance</h2>
          <p className="landing-section-lede">
            The controls below are the operating standard we are designing toward — not yet live.
          </p>
          <ul className="landing-trust-list">
            <li>KYC / AML onboarding with third-party identity providers</li>
            <li>Credit assessment for borrower eligibility (demo scoring today)</li>
            <li>Clear risk disclosures on every pool before capital is committed</li>
            <li>On-chain verifiability via XRPL Devnet explorer links</li>
            <li>Segregation of demo assets from any real-world funds</li>
          </ul>
          <p className="landing-note">
            Regulatory perimeter, policy suite, and independent assurance are under works.
            This deployment uses XRPL Devnet test assets with no monetary value.
          </p>
        </section>

        <section id="terms" className="landing-section">
          <h2>Terms &amp; conditions</h2>
          <p className="landing-section-lede">
            Draft terms for this demonstration. Final contractual terms will follow incorporation.
          </p>
          <div className="landing-terms">
            <p>
              <strong>1. Demonstration only.</strong> This website and application are provided
              solely for demonstration and educational purposes. CoinFish is not currently a
              licensed bank, payment institution, or investment firm.
            </p>
            <p>
              <strong>2. No real funds.</strong> Balances, pools, “RLUSD”, and on-chain actions
              run on the XRPL Devnet with throwaway test assets. No real money is held, moved,
              or at risk through this interface.
            </p>
            <p>
              <strong>3. No advice.</strong> Nothing here is an offer, solicitation, or advice
              to lend, borrow, invest, or enter into any financial contract.
            </p>
            <p>
              <strong>4. Risk.</strong> Even in production form, pool lending involves capital
              at risk, variable yield, exit queues, and first-loss structures that do not
              eliminate loss. Read pool disclosures carefully.
            </p>
            <p>
              <strong>5. Privacy.</strong> Signup fields (company name, contact, email) are for
              show in this demo and are not subject to a production privacy programme yet.
              A full privacy notice is under works.
            </p>
            <p>
              <strong>6. Changes.</strong> These draft terms may change without notice as the
              product and legal entity mature. Continued use of the demo constitutes acceptance
              of the version shown on this page.
            </p>
          </div>
        </section>

        <section id="contact" className="landing-section landing-section-last">
          <h2>Get in touch</h2>
          <p className="landing-section-lede">
            For the UK Finnovator judging panel and partners — reach the team via the repository
            or enter the live demo below.
          </p>
          <div className="landing-cta-row">
            <Link to="/app" className="landing-btn landing-btn-primary">
              Open the demo
            </Link>
            <a
              href="https://github.com/Neurarock/CoinFish"
              className="landing-btn landing-btn-ghost"
              target="_blank"
              rel="noreferrer"
            >
              GitHub repository ↗
            </a>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div>
          <span className="landing-footer-brand">CoinFish</span>
          <span> · Built by Team 5 for UK Finnovator · Ripple Track @ 2026</span>
        </div>
        <div className="landing-footer-links">
          <a href="#terms">Terms</a>
          <a href="#trust">Trust</a>
          <Link to="/app">Platform</Link>
        </div>
      </footer>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="landing-detail">
      <div className="landing-detail-label">{label}</div>
      <div className="landing-detail-value">{value}</div>
    </div>
  );
}
