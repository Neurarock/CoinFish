// Borrower dashboard: how much borrowed, interest paid, outstanding, plus a clear
// itemised bill. Per active loan you can repay interest-only, repay in full (with
// a min-term warning before the term elapses), or default (forfeit collateral +
// a clearly-shown default charge).
import { useEffect, useState } from "react";
import { api } from "../api.js";
import Layout from "../components/Layout.jsx";
import { Button, Stat, Pill, rlusd, gbp, pct } from "../components/ui.jsx";

export default function BorrowerDashboard() {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = () => api.borrowerDashboard().then(setD);
  useEffect(() => { load(); }, []);

  async function act(fn, loanId) {
    setMsg(null);
    try {
      const r = await fn();
      setMsg({ loanId, text: summarise(r), tone: "good" });
      load();
    } catch (e) { setMsg({ loanId, text: e.message, tone: "bad" }); }
  }

  if (!d) return <Layout role="borrower"><div>Loading…</div></Layout>;

  return (
    <Layout role="borrower">
      <h1 className="text-3xl font-extrabold">Borrowing dashboard</h1>
      <div className="mt-5 grid gap-4 sm:grid-cols-4">
        <Stat label="Total borrowed" value={rlusd(d.total_borrowed)} />
        <Stat label="Outstanding" value={rlusd(d.outstanding)} accent />
        <Stat label="Interest paid" value={rlusd(d.interest_paid)} />
        <Stat label="Available collateral" value={gbp(d.collateral_available)} />
      </div>

      {/* itemised bill */}
      <div className="card mt-6 p-5">
        <div className="font-bold">Your bill</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-4 text-sm">
          <Bill k="Interest paid" v={rlusd(d.bill.interest_paid)} />
          <Bill k="Origination fees" v={rlusd(d.bill.origination_fees)} />
          <Bill k="Default charges" v={rlusd(d.bill.default_charges)} tone={d.bill.default_charges > 0 ? "bad" : null} />
          <Bill k="Owed now" v={rlusd(d.bill.total_owed_now)} tone="accent" />
        </div>
      </div>

      <h2 className="mt-8 mb-3 text-xl font-bold">Loans</h2>
      <div className="space-y-3">
        {d.loans.length === 0 && (
          <div className="card p-5" style={{ color: "var(--fg-soft)" }}>No loans yet.</div>
        )}
        {d.loans.map((l) => (
          <div key={l.id} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold">
                {rlusd(l.principal)} · {pct(l.interest_rate)} · {l.term_hours}h
              </div>
              <Pill tone={statusTone(l.status)}>{l.status}</Pill>
            </div>
            <div className="mt-1 text-xs" style={{ color: "var(--fg-soft)" }}>
              pool {l.pool_key} · interest paid {rlusd(l.interest_paid)}
              {l.default_charge > 0 && <> · default charge {rlusd(l.default_charge)}</>}
              {l.origination_tx && <> · tx {l.origination_tx.slice(0, 12)}…</>}
            </div>
            {l.status === "active" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => act(() => api.repay(l.id, { mode: "interest" }), l.id)}>
                  Repay interest
                </Button>
                <Button onClick={() => act(() => api.repay(l.id, { mode: "full" }), l.id)}>
                  Repay in full
                </Button>
                <Button variant="ghost" className="ml-auto"
                  onClick={() => act(() => api.defaultLoan(l.id), l.id)}
                  style={{ color: "var(--bad)", borderColor: "var(--bad)" }}>
                  Default
                </Button>
              </div>
            )}
            {msg?.loanId === l.id && (
              <div className="mt-2 text-sm" style={{ color: `var(--${msg.tone})` }}>{msg.text}</div>
            )}
          </div>
        ))}
      </div>
    </Layout>
  );
}

function summarise(r) {
  if (r.mode === "interest") return `Interest paid: ${rlusd(r.interest_paid)}.`;
  if (r.mode === "full") return `Loan repaid in full. Collateral released.`;
  if (r.status === "defaulted") return `Defaulted. Collateral seized ${rlusd(r.collateral_seized)} (incl. ${rlusd(r.default_charge)} charge).`;
  return "Done.";
}
function statusTone(s) {
  return { active: "warn", repaid: "good", defaulted: "bad", quoted: "muted" }[s] || "muted";
}
function Bill({ k, v, tone }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "var(--bg)" }}>
      <div className="text-xs" style={{ color: "var(--fg-soft)" }}>{k}</div>
      <div className="font-bold" style={{ color: tone ? `var(--${tone})` : "var(--fg)" }}>{v}</div>
    </div>
  );
}
