// Global footer: GitHub repo (with logo), demo-only terms of service, and the
// team / event credit. The top edge is a slowly morphing gradient rule so the
// footer reads as part of the same "expensively made" system as the rest.
import { useState } from "react";
import Logo from "./Logo.jsx";

const REPO = "https://github.com/Neurarock/CoinFish";

export default function Footer() {
  const [terms, setTerms] = useState(false);
  return (
    <footer className="relative z-10 mt-16">
      <hr className="morph-rule" />
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-7 text-sm
                      md:flex-row md:items-center md:justify-between"
        style={{ color: "var(--fg-soft)" }}>
        <a href={REPO} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-2 font-semibold"
          style={{ color: "var(--fg)" }}>
          <GitHubLogo />
          <span>Neurarock/CoinFish</span>
          <span aria-hidden="true" style={{ opacity: 0.7 }}>↗</span>
        </a>

        <div className="text-center md:text-right">
          <span className="font-semibold morph-text">
            Built by Team 5 for UK Finnovator · Ripple Track @ 2026
          </span>
          <div className="mt-1">
            <button onClick={() => setTerms((v) => !v)}
              className="underline decoration-dotted underline-offset-2"
              style={{ color: "var(--fg-soft)" }}>
              Terms of Service
            </button>
            <span className="mx-2">·</span>
            <span className="inline-flex items-center gap-1"><Logo size={16} aura={false} /> CoinFish</span>
          </div>
        </div>
      </div>

      {terms && (
        <div className="mx-auto max-w-6xl px-6 pb-8">
          <div className="card p-4 text-xs leading-relaxed" style={{ color: "var(--fg-soft)" }}>
            <b style={{ color: "var(--fg)" }}>Terms of Service.</b> This site is provided
            for <b>demonstration purposes only</b> and is <b>not a working financial services
            platform</b>. Nothing here is an offer, solicitation, or advice to lend, borrow, or
            invest. Balances, pools, “RLUSD”, and on-chain actions run on the XRPL <b>Devnet</b>
            with throwaway test assets that carry no monetary value. No real money is held,
            moved, or at risk. Use at your own discretion.
          </div>
        </div>
      )}
    </footer>
  );
}

function GitHubLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
        0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01
        1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95
        0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27
        2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82
        1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01
        2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
