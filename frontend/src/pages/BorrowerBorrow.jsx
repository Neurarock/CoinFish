// Borrower borrow screen. Shows pools the borrower is eligible for (from their
// collateral + current LTV), lets them request a quote for an amount + term, and
// the quote is LIVE FOR 5 SECONDS — a countdown ring runs; accept within the
// window disburses the loan to the connected wallet, else it expires.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import Layout from "../components/Layout.jsx";
import { Button, Pill, rlusd, pct } from "../components/ui.jsx";

export default function BorrowerBorrow() {
  const [d, setD] = useState(null);
  const [pool, setPool] = useState(null);
  const [amount, setAmount] = useState(20000);
  const [term, setTerm] = useState(12);
  const [quote, setQuote] = useState(null);
  const [left, setLeft] = useState(0);
  const [msg, setMsg] = useState("");
  const timer = useRef(null);
  const nav = useNavigate();

  useEffect(() => { api.borrowerDashboard().then(setD); }, []);

  function startCountdown(secs) {
    clearInterval(timer.current);
    const end = Date.now() + secs * 1000;
    timer.current = setInterval(() => {
      const s = Math.max(0, (end - Date.now()) / 1000);
      setLeft(s);
      if (s <= 0) clearInterval(timer.current);
    }, 100);
  }

  async function getQuote() {
    setMsg("");
    try {
      const q = await api.quote({ pool_key: pool, amount: Number(amount), term_hours: Number(term) });
      setQuote(q);
      startCountdown(q.seconds_left);
    } catch (e) { setMsg(e.message); }
  }

  async function accept() {
    setMsg("");
    try {
      const r = await api.acceptQuote({ quote_id: quote.id });
      setMsg(`Disbursed ${rlusd(r.principal)} to ${r.disbursed_to.slice(0, 12)}… (tx ${r.tx_hash.slice(0, 12)}…)`);
      setQuote(null);
      setTimeout(() => nav("/borrower/dashboard"), 1200);
    } catch (e) { setMsg(e.message); }
  }

  if (!d) return <Layout role="borrower"><div>Loading…</div></Layout>;
  const expired = quote && left <= 0;

  return (
    <Layout role="borrower">
      <h1 className="text-3xl font-extrabold">Borrow</h1>
      <p className="mt-1 mb-6" style={{ color: "var(--fg-soft)" }}>
        Eligibility is set by your available collateral and current loan-to-value. Quotes are
        live for 5 seconds — accept fast and the loan lands in your wallet in seconds.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        {d.eligible_pools.map((p) => (
          <button key={p.key} disabled={!p.eligible} onClick={() => setPool(p.key)}
            className="card p-4 text-left disabled:opacity-40"
            style={{ outline: pool === p.key ? "2px solid var(--accent)" : "none" }}>
            <div className="flex items-center justify-between">
              <div className="font-bold">{p.name}</div>
              <Pill tone={p.eligible ? "good" : "muted"}>{p.eligible ? "eligible" : "not eligible"}</Pill>
            </div>
            <Row k="From APR" v={pct(p.base_apr)} />
            <Row k="Max borrow" v={rlusd(p.max_borrow)} />
            <Row k="Current LTV" v={pct(p.current_ltv)} />
            <Row k="Pool liquidity" v={rlusd(p.available_liquidity)} />
          </button>
        ))}
      </div>

      {pool && (
        <div className="card mt-6 p-5">
          <div className="font-bold">Request a quote</div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Num label="Amount (RLUSD)" value={amount} onChange={setAmount} />
            <Num label="Term (hours, max 24)" value={term} onChange={setTerm} />
            <Button onClick={getQuote}>Request quote</Button>
          </div>

          {quote && (
            <div className="mt-5 flex items-center gap-5 rounded-2xl p-4"
              style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
              <Countdown left={left} total={5} />
              <div className="flex-1">
                {quote.approved ? (
                  <>
                    <div className="text-sm" style={{ color: "var(--fg-soft)" }}>Offered rate</div>
                    <div className="text-3xl font-extrabold" style={{ color: "var(--accent)" }}>
                      {pct(quote.interest_rate)} <span className="text-base">APR</span>
                    </div>
                    <div className="text-xs" style={{ color: "var(--fg-soft)" }}>
                      {rlusd(quote.principal)} · {quote.term_hours}h · origination {rlusd(quote.origination_fee)}
                    </div>
                  </>
                ) : (
                  <div style={{ color: "var(--bad)" }}>Declined: {quote.reason}</div>
                )}
              </div>
              {quote.approved && (
                <Button onClick={accept} disabled={expired}>
                  {expired ? "Expired — re-quote" : `Accept (${left.toFixed(1)}s)`}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      {msg && <div className="mt-4 text-sm" style={{ color: "var(--accent)" }}>{msg}</div>}
    </Layout>
  );
}

function Countdown({ left, total }) {
  const r = 26, c = 2 * Math.PI * r;
  const frac = Math.max(0, left / total);
  return (
    <svg width="64" height="64" viewBox="0 0 64 64">
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
function Num({ label, value, onChange }) {
  return (
    <label className="flex-1">
      <span className="text-xs font-semibold" style={{ color: "var(--fg-soft)" }}>{label}</span>
      <input className="input mt-1" type="number" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span style={{ color: "var(--fg-soft)" }}>{k}</span>
      <span className="font-bold">{v}</span>
    </div>
  );
}
