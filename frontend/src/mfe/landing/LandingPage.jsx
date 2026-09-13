// Marketing mini-frontend — Houdini-style dual portals: Launch App + Partner Portal.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../../shared/components/Logo.jsx";
import DevnetBadge from "../../shared/components/DevnetBadge.jsx";
import WaterRipple from "./WaterRipple.jsx";
import TriangleJump from "./TriangleJump.jsx";
import PolkaWave from "./PolkaWave.jsx";
import PixelFigure from "./PixelFigure.jsx";
import { Reveal } from "./useReveal.jsx";
import { openCookieSettings } from "../../shared/consent/index.js";
import "./landing.css";

const PILLARS = [
  {
    id: "product",
    title: "Product",
    body: "Risk-tiered pools, off-chain collateral, and on-ledger RLUSD — lend, borrow, and operate from one surface.",
    to: "/app",
  },
  {
    id: "customer",
    title: "Customer",
    body: "Built for treasury desks, fiat-rich operators, and partners who need quiet liquidity rails — not a retail casino.",
    to: "/partners",
  },
  {
    id: "governance",
    title: "Governance",
    body: "Institutional-grade compliance: KYC / AML pathways, pool disclosures, and on-chain verifiability on XRPL Devnet.",
    to: "#pending-governance",
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

const MARKET_STATS = [
  {
    figure: "$13T",
    label: "JPMorgan Chase",
    body: "Projects a $13 trillion TradFi liquidity onboarded onto crypto rails by 2030.",
  },
  {
    figure: "5–10%",
    label: "Boutique & regional firms",
    body: "Broker-dealers and smaller traditional market makers in regional equities or commodities — most lack capital or approval for digital-asset desks.",
  },
  {
    figure: "<5%",
    label: "Global investment banks",
    body: "Institutions like Citadel Securities, Virtu, and Morgan Stanley may touch crypto derivatives or OTC — but regulation limits direct on-chain liquidity.",
  },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(0);
  const [heroInView, setHeroInView] = useState(true);
  const rippleRef = useRef(null);
  const heroRef = useRef(null);
  const partnerCtaRef = useRef(null);

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
      <PolkaWave frostElRef={partnerCtaRef} />
      <TriangleJump rippleRef={rippleRef} active={heroInView} />

      <header className="landing-nav">
        <Link to="/" className="landing-brand">
          <Logo size={44} aura={false} />
          <span>CoinFish</span>
        </Link>
        <nav className="landing-nav-links">
          <a href="#explore">Explore</a>
          <a href="#faq">FAQ</a>
          <div className="landing-nav-actions">
            <DevnetBadge />
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
          <p className="landing-tagline-hero">
            <span className="landing-accent-word">Liquidity</span> that moves beneath the{" "}
            <span className="landing-accent-word">surface</span>
          </p>
          <p className="landing-lede">
            Off-chain collateral instant On-chain RLUSD. Infrastructure for those who already
            know.
          </p>
          <div className="landing-cta-row">
            <Link to="/app" className="landing-btn landing-btn-primary">
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="landing-nav-icon landing-cta-icon">
                <path
                  fill="currentColor"
                  d="M16.5 12a3.5 3.5 0 1 0-3.4-4.3L9.7 9.9a3.5 3.5 0 1 0 0 4.2l3.4 2.2a3.5 3.5 0 1 0 .9-1.5l-3.4-2.2a3.6 3.6 0 0 0 0-1.2l3.4-2.2c.4.3.9.5 1.5.5Zm-9 1.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm9-6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"
                />
              </svg>
              Launch App
              <span aria-hidden="true" className="landing-nav-arrow landing-cta-arrow">↗</span>
            </Link>
            <Link
              ref={partnerCtaRef}
              to="/partners"
              className="landing-btn landing-cta-partner"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="landing-nav-icon landing-cta-icon">
                <path
                  fill="currentColor"
                  d="M16.5 12a3.5 3.5 0 1 0-3.4-4.3L9.7 9.9a3.5 3.5 0 1 0 0 4.2l3.4 2.2a3.5 3.5 0 1 0 .9-1.5l-3.4-2.2a3.6 3.6 0 0 0 0-1.2l3.4-2.2c.4.3.9.5 1.5.5Zm-9 1.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm9-6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 9a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"
                />
              </svg>
              Partner Portal
              <span aria-hidden="true" className="landing-nav-arrow landing-cta-arrow">↗</span>
            </Link>
          </div>
        </section>

        <Reveal as="section" className="landing-stats" aria-label="Market signal">
          <p className="landing-stats-kicker" data-reveal-child>
            TradFi is coming on-chain
          </p>
          <p className="landing-stats-lede" data-reveal-child>
            A massive market to bridge — not only direct onboarding and offboarding, but
            credit-based liquidity for institutions that cannot sit fully on-ledger yet.
          </p>
          <div className="landing-stats-row">
            {MARKET_STATS.map((stat) => (
              <article key={stat.label} className="landing-stat" data-reveal-child>
                <PixelFigure value={stat.figure} />
                <h3>{stat.label}</h3>
                <p>{stat.body}</p>
              </article>
            ))}
          </div>
        </Reveal>

        <section id="explore" className="landing-section landing-section-wide">
          <h2>Explore</h2>
          <p className="landing-section-lede">
            Product, customer, and governance — three doors into the same quiet pool.
          </p>
          <div className="landing-pillars">
            {PILLARS.map((item) => {
              const Tag = item.to.startsWith("/") ? Link : "a";
              const linkProps = item.to.startsWith("/")
                ? { to: item.to }
                : { href: item.to };
              return (
                <Tag key={item.id} className="landing-pillar" {...linkProps}>
                  <span className="landing-pillar-arrow" aria-hidden="true">↗</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </Tag>
              );
            })}
          </div>
        </section>

        <Reveal as="section" id="faq" className="landing-section landing-section-wide">
          <h2 data-reveal-child>Frequently asked questions</h2>
          <p className="landing-section-lede" data-reveal-child>
            Straight answers for a demonstration build still finding its depth.
          </p>
          <div className="landing-faq" role="list">
            {FAQS.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={item.q} data-reveal-child role="presentation">
                  <div
                    className={`landing-faq-item${open ? " is-open" : ""}`}
                    role="listitem"
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
                </div>
              );
            })}
          </div>
        </Reveal>
      </main>

      <div className="landing-social" aria-label="Social">
        <a
          className="landing-social-link"
          href="#pending-linkedin"
          title="LinkedIn — link pending"
          aria-label="LinkedIn (link pending)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.24 8.34h4.52V24H.24V8.34zM8.34 8.34h4.33v2.13h.06c.6-1.14 2.08-2.34 4.28-2.34 4.58 0 5.42 3.01 5.42 6.93V24h-4.52v-7.75c0-1.85-.03-4.22-2.57-4.22-2.57 0-2.96 2.01-2.96 4.09V24H8.34V8.34z"
            />
          </svg>
        </a>
        <a
          className="landing-social-link"
          href="#pending-telegram"
          title="Telegram — link pending"
          aria-label="Telegram (link pending)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M11.94 0C5.34 0 0 5.34 0 11.94c0 6.6 5.34 11.94 11.94 11.94 6.6 0 11.94-5.34 11.94-11.94C23.88 5.34 18.54 0 11.94 0zm5.52 8.16-1.86 8.76c-.12.66-.54.82-1.08.51l-3-2.22-1.44 1.38c-.18.18-.3.3-.6.3l.24-3.36 6.12-5.52c.24-.24-.06-.36-.42-.12l-7.56 4.74-3.24-1.02c-.72-.24-.72-.72.12-1.02l12.66-4.86c.6-.24 1.14.12 1.02.87z"
            />
          </svg>
        </a>
        <a
          className="landing-social-link"
          href="#pending-x"
          title="X — link pending"
          aria-label="X (link pending)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M18.24 2H21.5l-7.16 8.19L22.7 22h-6.59l-5.16-6.75L5.1 22H1.82l7.66-8.76L1.3 2h6.76l4.66 6.18L18.24 2zm-1.16 18h1.82L7.04 3.9H5.1L17.08 20z"
            />
          </svg>
        </a>
        <a
          className="landing-social-link"
          href="#pending-youtube"
          title="YouTube — link pending"
          aria-label="YouTube (link pending)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.38.46A3.02 3.02 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.12 2.14C4.5 20.4 12 20.4 12 20.4s7.5 0 9.38-.46a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8zM9.6 15.6V8.4L15.8 12 9.6 15.6z"
            />
          </svg>
        </a>
      </div>

      <footer className="landing-footer">
        <div className="landing-footer-top">
          <div>
            <span className="landing-footer-brand">CoinFish</span>
            <span> · Beneath the surface</span>
          </div>
          <div className="landing-footer-links">
            <a href="#faq">FAQ</a>
            <a href="#explore">Explore</a>
            <a href="#pending-privacy">Privacy Policy</a>
            <Link to="/partners">Partners</Link>
            <Link to="/app">Launch App</Link>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <p className="landing-footer-fineprint">
            Demonstration only. Not a licensed bank or investment firm; nothing here is an offer
            to lend, borrow, or invest. Pools and RLUSD run on XRPL Devnet with test assets — no
            real funds. Pool lending involves capital at risk, variable yield, and exit queues;
            first-loss buffers do not eliminate loss. Draft terms for demonstration; final
            contracts follow incorporation. CoinFish Ltd (working title) · United Kingdom ·
            registration under way · Team 5 for UK Finnovator · Ripple Track @ 2026 ·
            hello@coinfish.finance (placeholder)
          </p>
          <div className="landing-footer-legal">
            <a
              href="#pending-cookies"
              onClick={(e) => {
                e.preventDefault();
                openCookieSettings();
              }}
            >
              Cookies Policy
            </a>
            <a href="#pending-modern-slavery">Modern Slavery Statement</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
