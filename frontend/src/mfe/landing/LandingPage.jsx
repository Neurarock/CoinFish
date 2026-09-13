// Marketing mini-frontend — Houdini-style dual portals: Launch App + Partner Portal.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../../shared/components/Logo.jsx";
import DevnetBadge from "../../shared/components/DevnetBadge.jsx";
import { api } from "../../shared/api.js";
import WaterRipple from "./WaterRipple.jsx";
import TriangleJump from "./TriangleJump.jsx";
import { Reveal } from "./useReveal.jsx";
import "./landing.css";

const USE_CASES = [
  {
    title: "Treasury yield",
    body: "Park idle RLUSD in risk-tiered pools. See utilisation in real time. Exit through a clear queue — not a black box.",
  },
  {
    title: "Working capital",
    body: "Fiat-rich operators post collateral off-chain and draw on-ledger liquidity when settlement windows tighten.",
  },
  {
    title: "Platform rails",
    body: "Partners embed CoinFish liquidity behind their own brand — keys, usage, and commissions via the Partner Portal.",
  },
  {
    title: "Operator oversight",
    body: "The vault surfaces solvency, fees, and loans in grace so risk sits in one calm control room.",
  },
];

const FAQS = [
  {
    q: "Is CoinFish live with real money?",
    a: "No. This build is a demonstration on XRPL Devnet. Balances and RLUSD are test assets with no monetary value.",
  },
  {
    q: "Who is Launch App for?",
    a: "Lenders funding pools and borrowers drawing RLUSD against fiat collateral. Sign up, complete demo KYC, connect a wallet, and enter.",
  },
  {
    q: "What is the Partner Portal?",
    a: "A separate surface for integrators — API credentials, usage, and commissions. The login is a placeholder in this demo.",
  },
  {
    q: "Which chain does CoinFish use?",
    a: "The XRP Ledger. On-chain actions are verifiable through Devnet explorer links from inside the app.",
  },
  {
    q: "Are my funds at risk in the demo?",
    a: "No real funds are held or moved. In a future production form, pool lending would involve capital at risk and variable yield — read disclosures carefully.",
  },
  {
    q: "Is CoinFish a regulated bank?",
    a: "Not currently. CoinFish is not a licensed bank, payment institution, or investment firm. Legal entity details are under works.",
  },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(0);
  const [status, setStatus] = useState(null);
  const [heroInView, setHeroInView] = useState(true);
  const rippleRef = useRef(null);
  const heroRef = useRef(null);

  useEffect(() => {
    api.runtimeStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => setHeroInView(entry.isIntersecting && entry.intersectionRatio > 0.35),
      { threshold: [0, 0.35, 0.6, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="landing-page">
      <WaterRipple ref={rippleRef} />
      <TriangleJump rippleRef={rippleRef} active={heroInView} />

      <header className="landing-nav">
        <Link to="/" className="landing-brand">
          <Logo size={44} aura={false} />
          <span>CoinFish</span>
        </Link>
        <nav className="landing-nav-links">
          <a href="#products">Products</a>
          <a href="#use-cases">Use cases</a>
          <a href="#faq">FAQ</a>
          <a href="#trust">Trust</a>
          <div className="landing-nav-actions">
            <DevnetBadge status={status} />
            <Link to="/partners" className="landing-nav-btn landing-nav-btn-partner">
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="landing-nav-icon">
                <path
                  fill="currentColor"
                  d="M16.5 12a3.5 3.5 0 1 0-3.4-4.3L9.7 9.9a3.5 3.5 0 1 0 0 4.2l3.4 2.2a3.5 3.5 0 1 0 .9-1.5l-3.4-2.2a3.6 3.6 0 0 0 0-1.2l3.4-2.2c.4.3.9.5 1.5.5Zm-9 1.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm9-6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"
                />
              </svg>
              Partner Portal
              <span aria-hidden="true" className="landing-nav-arrow">↗</span>
            </Link>
            <Link to="/app" className="landing-nav-btn landing-nav-btn-launch">
              Launch App
              <span aria-hidden="true" className="landing-nav-arrow">↗</span>
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="landing-hero" ref={heroRef}>
          <h1 className="landing-brand-hero">CoinFish</h1>
          <p className="landing-lede">
            Liquidity that moves beneath the surface — fiat collateral, on-chain RLUSD,
            quiet infrastructure for those who already know.
          </p>
          <div className="landing-cta-row">
            <Link to="/app" className="landing-btn landing-btn-primary">
              Launch App
            </Link>
            <Link to="/partners" className="landing-btn landing-btn-ghost">
              Partner Portal
            </Link>
          </div>
        </section>

        <Reveal as="section" className="landing-tagline reveal-scale" aria-label="Tagline">
          <div className="landing-tagline-inner">
            <p className="landing-tagline-eyebrow">The quiet pool</p>
            <p className="landing-tagline-text">
              Beneath the surface,<br />
              capital finds its depth.
            </p>
          </div>
        </Reveal>

        <Reveal as="section" id="products" className="landing-section">
          <h2 data-reveal-child>Under the surface</h2>
          <p className="landing-section-lede" data-reveal-child>
            Three coordinated worlds. One risk engine. Built for the XRP Ledger.
          </p>
          <ul className="landing-product-list">
            <li data-reveal-child>
              <strong>Lend</strong>
              <span>Supply RLUSD into risk-tiered pools. Watch utilisation. Exit when you choose.</span>
            </li>
            <li data-reveal-child>
              <strong>Borrow</strong>
              <span>Post fiat off-chain. Draw stablecoin on-ledger. Quotes that refresh in seconds.</span>
            </li>
            <li data-reveal-child>
              <strong>Vault</strong>
              <span>Operator view — solvency, fees, loans in grace. The control room beneath.</span>
            </li>
          </ul>
        </Reveal>

        <Reveal as="section" id="use-cases" className="landing-section landing-section-wide">
          <h2 data-reveal-child>Use cases</h2>
          <p className="landing-section-lede" data-reveal-child>
            Where CoinFish fits — from treasury desks to platforms that need liquidity rails.
          </p>
          <div className="landing-usecases">
            {USE_CASES.map((item, i) => (
              <article key={item.title} className="landing-usecase" data-reveal-child>
                <span className="landing-usecase-num">{String(i + 1).padStart(2, "0")}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </Reveal>

        <Reveal as="section" id="partners" className="landing-section">
          <h2 data-reveal-child>Partner programme</h2>
          <p className="landing-section-lede" data-reveal-child>
            Integrators, platforms, and institutions — access keys, usage, and commission
            tooling. The portal is opening; credentials are placeholder for this demo.
          </p>
          <div className="landing-cta-row" data-reveal-child>
            <Link to="/partners" className="landing-btn landing-btn-ghost">
              Enter Partner Portal
            </Link>
          </div>
        </Reveal>

        <Reveal as="section" id="faq" className="landing-section landing-section-wide">
          <h2 data-reveal-child>Frequently asked questions</h2>
          <p className="landing-section-lede" data-reveal-child>
            Straight answers for a demonstration build still finding its depth.
          </p>
          <div className="landing-faq" role="list">
            {FAQS.map((item, i) => {
              const open = openFaq === i;
              return (
                <div
                  key={item.q}
                  className={`landing-faq-item${open ? " is-open" : ""}`}
                  role="listitem"
                  data-reveal-child
                >
                  <button
                    type="button"
                    className="landing-faq-q"
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? -1 : i)}
                  >
                    <span>{item.q}</span>
                    <span className="landing-faq-icon" aria-hidden="true" />
                  </button>
                  <div className="landing-faq-a" hidden={!open}>
                    <p>{item.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>

        <Reveal as="section" id="trust" className="landing-section">
          <h2 data-reveal-child>Trust</h2>
          <p className="landing-section-lede" data-reveal-child>
            Designed toward institutional controls — not yet a live regulated service.
          </p>
          <ul className="landing-trust-list">
            <li data-reveal-child>KYC / AML pathways and credit checks in the Launch App demo</li>
            <li data-reveal-child>Pool risk disclosures before capital is committed</li>
            <li data-reveal-child>On-chain verifiability via XRPL Devnet explorer links</li>
            <li data-reveal-child>Demo assets only — no real funds, no monetary value</li>
          </ul>
        </Reveal>

        <Reveal as="section" id="terms" className="landing-section">
          <h2 data-reveal-child>Terms</h2>
          <p className="landing-section-lede" data-reveal-child>
            Draft terms for demonstration. Final contracts follow incorporation.
          </p>
          <div className="landing-terms" data-reveal-child>
            <p>
              <strong>Demonstration only.</strong> CoinFish is not a licensed bank or
              investment firm. Nothing here is an offer to lend, borrow, or invest.
            </p>
            <p>
              <strong>No real funds.</strong> Pools and RLUSD run on XRPL Devnet with
              throwaway test assets. Use at your own discretion.
            </p>
            <p>
              <strong>Risk.</strong> Pool lending involves capital at risk, variable yield,
              and exit queues. First-loss buffers do not eliminate loss.
            </p>
          </div>
        </Reveal>

        <section className="landing-section landing-section-last">
          <p className="landing-footnote">
            CoinFish Ltd (working title) · United Kingdom · registration under way ·
            Team 5 for UK Finnovator · Ripple Track @ 2026 · hello@coinfish.finance (placeholder)
          </p>
        </section>
      </main>

      <footer className="landing-footer">
        <div>
          <span className="landing-footer-brand">CoinFish</span>
          <span> · Beneath the surface</span>
        </div>
        <div className="landing-footer-links">
          <a href="#faq">FAQ</a>
          <a href="#terms">Terms</a>
          <Link to="/partners">Partners</Link>
          <Link to="/app">Launch App</Link>
          <Link to="/vault">Vault</Link>
        </div>
      </footer>
    </div>
  );
}
