// Borrower borrow screen. The borrower enters an amount once and CoinFish quotes
// EVERY pool at the same time so they can shop around — each pool uses its own
// default term (Conservative 24h / Balanced 48h / High-Yield 72h), so the rate
// and total interest differ and the trade-off is visible side by side.
//
// Eligible pools show a live (5s) quote with a countdown ring + Accept button.
// Ineligible pools show the reason and a friendly "thank you" card instead.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import Layout from "../components/Layout.jsx";
import { useTx } from "../components/TxProcessing.jsx";
import { Button, Pill, VerifyLink, rlusd, pct } from "../components/ui.jsx";

const QUOTE_WINDOW = 5; // seconds a quote stays live

export default function BorrowerBorrow() {
  const [amount, setAmount] = useState(20000);
  const [data, setData] = useState(null);   // { amount, quotes: [...] }
  const [now, setNow] = useState(Date.now() / 1000);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  const nav = useNavigate();
  const { track } = useTx();

  // a single ticking clock drives every card's countdown
  useEffect(() => {
    timer.current = setInterval(() => setNow(Date.now() / 1000), 100);
    return () => clearInterval(timer.current);
  }, []);

  async function getQuotes() {
    setMsg(null);
    setLoading(true);
    try {
      const r = await api.quotesAll({ amount: Number(amount) });
      setData(r);
    } catch (e) { setMsg({ error: e.message }); }
    finally { setLoading(false); }
  }

  async function accept(q) {
    setMsg(null);
    try {
      const r = await track(
        api.acceptQuote({ quote_id: q.id }),
        {
          title: "Originating your loan",
          steps: ["Broker co-signs LoanSet", "You co-sign", "Submitting to XRPL",
                  "Disbursing RLUSD to your wallet"],
          success: "Loan disbursed",
        },
      );
      setMsg({
        text: `Disbursed ${rlusd(r.principal)} to ${r.disbursed_to.slice(0, 12)}…. Wallet balance ${rlusd(r.wallet_balance)}.`,
        tx_hash: r.tx_hash,
        explorer_url: r.explorer_url,
      });
      setData(null);
      setTimeout(() => nav("/borrower/dashboard"), 1200);
    } catch (e) { setMsg({ error: e.message }); }
  }

  const eligible = (data?.quotes || []).filter((q) => q.eligible && q.quote);
  const blocked = (data?.quotes || []).filter((q) => !(q.eligible && q.quote));

  return (
    <Layout role="borrower">
      <h1 className="text-3xl font-extrabold">
        <span className="morph-text">Borrow</span>
      </h1>
      <p className="mt-1 mb-6" style={{ color: "var(--fg-soft)" }}>
        Enter an amount and we quote every pool at once. Each pool commits for a
        different term — longer terms are cheaper, shorter terms are more flexible —
        so it pays to shop around. Quotes are live for {QUOTE_WINDOW} seconds.
      </p>

      <div className="card p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1">
            <span className="text-xs font-semibold" style={{ color: "var(--fg-soft)" }}>Amount (RLUSD)</span>
            <input className="input mt-1" type="number" value={amount}
              onChange={(e) => setAmount(e.target.value)} />
          </label>
          <Button onClick={getQuotes} disabled={loading}>
            {loading ? "Quoting…" : data ? "Re-quote all pools" : "Get quotes from all pools"}
          </Button>
        </div>
      </div>

      {eligible.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-xl font-bold">Your offers · shop around</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {eligible.map((p) => (
              <QuoteCard key={p.pool_key} p={p} left={leftFor(p.quote, now)} onAccept={() => accept(p.quote)} />
            ))}
          </div>
        </>
      )}

      {blocked.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-xl font-bold">Not available right now</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {blocked.map((p) => <ThankYouCard key={p.pool_key} p={p} />)}
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="card mt-6 p-6 text-sm" style={{ color: "var(--fg-soft)" }}>
          Enter an amount above and we’ll line up every pool you qualify for.
        </div>
      )}

      {msg && (
        <div className="mt-6 text-sm" style={{ color: msg.error ? "var(--bad)" : "var(--accent)" }}>
          {msg.error || msg.text}
          <VerifyLink href={msg.explorer_url} hash={msg.tx_hash} label="Verify on XRPL" />
        </div>
      )}
    </Layout>
  );
}

function leftFor(quote, now) {
  if (!quote?.expires_at) return 0;
  return Math.max(0, quote.expires_at - now);
}

function QuoteCard({ p, left, onAccept }) {
  const q = p.quote;
  const expired = left <= 0;
  const tone = p.risk_tier === "low" ? "good" : p.risk_tier === "high" ? "bad" : "warn";
  return (
    <div className="morph-edge p-4">
      <div className="flex items-center justify-between">
        <div className="font-bold">{p.name}</div>
        <Pill tone={tone}>{p.risk_tier} risk</Pill>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <Countdown left={left} total={QUOTE_WINDOW} />
        <div>
          <div className="text-xs" style={{ color: "var(--fg-soft)" }}>Offered rate</div>
          <div className="text-3xl font-extrabold morph-text">{pct(q.interest_rate)}</div>
          <div className="text-[11px]" style={{ color: "var(--fg-soft)" }}>APR · {q.term_hours}h term</div>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <Row k="Principal" v={rlusd(q.principal)} />
        <Row k="Term" v={`${q.term_hours} hours`} />
        <Row k="Total interest" v={rlusd(q.total_interest)} />
        <Row k="Origination fee" v={rlusd(q.origination_fee)} />
      </div>

      <Button className="mt-4 w-full justify-center" disabled={expired} onClick={onAccept}>
        {expired ? "Expired — re-quote" : `Accept · ${left.toFixed(1)}s`}
      </Button>
    </div>
  );
}

// A polite "thank you" card for pools the borrower can't take right now.
function ThankYouCard({ p }) {
  return (
    <div className="card p-4" style={{ opacity: 0.96 }}>
      <div className="flex items-center justify-between">
        <div className="font-bold">{p.name}</div>
        <Pill tone="muted">not eligible</Pill>
      </div>
      <div className="mt-4 flex flex-col items-center text-center">
        <div className="text-3xl animate-bob">🐟</div>
        <div className="mt-2 text-sm font-semibold">Thanks for considering this pool</div>
        <div className="mt-1 text-xs" style={{ color: "var(--fg-soft)" }}>
          {p.reason || "You’re not eligible for this pool right now."}
        </div>
        <div className="mt-3 text-[11px]" style={{ color: "var(--fg-soft)" }}>
          {p.default_term_hours}h term · from {pct(p.base_apr)} APR
        </div>
      </div>
    </div>
  );
}

function Countdown({ left, total }) {
  const r = 26, c = 2 * Math.PI * r;
  const frac = Math.max(0, left / total);
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" style={{ flex: "none" }}>
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--accent)" strokeWidth="6"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)}
        transform="rotate(-90 32 32)" style={{ transition: "stroke-dashoffset 0.1s linear" }} />
      <text x="32" y="37" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--fg)">
        {left.toFixed(0)}
      </text>
    </svg>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-sm">
      <span style={{ color: "var(--fg-soft)" }}>{k}</span>
      <span className="font-bold">{v}</span>
    </div>
  );
}
