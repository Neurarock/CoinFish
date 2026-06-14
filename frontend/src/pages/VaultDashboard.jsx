// CoinFish Vault — operator console, styled after the XRPL Devnet explorer
// (devnet.xrpl.org): a clean dark ledger view, hairline-divided data tables,
// boxy corners, monospace figures. Shows fee revenue, solvency, risk, pool
// utilisation, the at-risk loan queue with a grace control, and the live XRPL
// transaction feed.
import { useEffect, useState } from "react";
import { api } from "../api.js";
import Layout from "../components/Layout.jsx";
import TxLedger from "../components/TxLedger.jsx";
import { useTx } from "../components/TxProcessing.jsx";
import { Button, Pill, VerifyLink, rlusd, usd, pct } from "../components/ui.jsx";

const POOL_COLS = "1.5fr .7fr 1.4fr 1fr 1fr 1fr 1fr .7fr";

export default function VaultDashboard() {
  const [d, setD] = useState(null);
  const [acc, setAcc] = useState(null);
  const [hours, setHours] = useState({});
  const [txs, setTxs] = useState([]);
  const [tick, setTick] = useState(0);
  const { track } = useTx();

  const load = () => {
    api.adminDashboard().then(setD);
    api.adminAccounts().then(setAcc).catch(() => setAcc(null));
    api.allTransactions().then(setTxs).catch(() => setTxs([]));
  };
  useEffect(() => {
    load();
    const t = setInterval(() => { load(); setTick((n) => n + 1); }, 5000);
    return () => clearInterval(t);
  }, []);

  async function extend(loan_id) {
    await api.extendGrace({ loan_id, hours: Number(hours[loan_id] || 1) });
    load();
  }

  // CoinFish (loan-broker owner) defaults a past-grace loan on-chain.
  async function defaultLoan(loan_id) {
    try {
      await track(
        api.adminDefault({ loan_id }),
        {
          title: "Defaulting loan",
          steps: ["LoanManage · default", "Drawing first-loss cover",
                  "Socialising residual loss", "Seizing pledged collateral"],
          success: "Loan defaulted",
        },
      );
      load();
    } catch { /* overlay shows the error (e.g. not past grace yet) */ }
  }

  if (!d) return <Layout role="admin"><div className="px-1 py-10" style={{ color: "var(--fg-soft)" }}>Loading ledger…</div></Layout>;

  return (
    <Layout role="admin">
      {/* explorer-style title bar */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3"
        style={{ borderColor: "var(--line)" }}>
        <div>
          <div className="vault-kicker">CoinFish · command layer</div>
          <h1 className="text-2xl font-extrabold"><span className="morph-text">Vault explorer</span></h1>
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--fg-soft)" }}>
          <span className="inline-flex items-center gap-1.5">
            <span className="devnet-orb" style={{ width: ".5rem", height: ".5rem", background: "var(--accent)" }} />
            live · refreshes every 5s
          </span>
          <Pill tone={d.underwater ? "bad" : "good"}>
            {d.underwater ? "underwater" : "solvent"} · {d.solvency_ratio}×
          </Pill>
        </div>
      </div>

      {/* metrics strip — explorer header cells */}
      <div className="exp-panel mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <Metric label="Fees collected" value={rlusd(d.fees_collected)} accent divider />
        <Metric label="Total TVL" value={rlusd(d.total_tvl)} divider />
        <Metric label="Out on loan" value={rlusd(d.total_drawn)} divider />
        <Metric label="First-loss" value={rlusd(d.total_first_loss)} divider />
        <Metric label="Solvency" value={`${d.solvency_ratio}×`} divider />
        <Metric label={`Risk · ${d.risk_band}`} value={Math.round(d.risk_score)}
          tone={d.risk_band === "low" ? "good" : d.risk_band === "critical" ? "bad" : "warn"} />
      </div>

      {/* risk meter */}
      <div className="exp-panel mt-4 p-4">
        <div className="exp-head mb-2">Composite vault exposure</div>
        <RiskMeter score={d.risk_score} band={d.risk_band} />
      </div>

      {/* pools table */}
      <SectionTitle>Pools <span className="ml-1 text-[10px] font-semibold" style={{ color: "var(--fg-soft)" }}>(live on-chain)</span></SectionTitle>
      <div className="exp-panel overflow-x-auto">
        <div className="exp-row exp-head" style={{ gridTemplateColumns: POOL_COLS, minWidth: 640 }}>
          <div>Pool</div><div>Risk</div><div>Utilisation</div>
          <div className="text-right">TVL</div><div className="text-right">Available</div>
          <div className="text-right">Out on loan</div><div className="text-right">First-loss</div>
          <div className="text-right">Cover</div>
        </div>
        {d.pools.map((p) => (
          <div key={p.key} className="exp-row" style={{ gridTemplateColumns: POOL_COLS, minWidth: 640 }}>
            <div className="font-bold">{p.name}</div>
            <div><Pill tone={p.utilisation > 0.85 ? "bad" : p.utilisation > 0.6 ? "warn" : "good"}>{p.risk_tier ?? p.key}</Pill></div>
            <div className="flex items-center gap-2">
              <UtilBar v={p.utilisation} />
              <span className="mono text-xs" style={{ color: "var(--fg-soft)" }}>{pct(p.utilisation)}</span>
            </div>
            <div className="mono text-right">{rlusd(p.tvl)}</div>
            <div className="mono text-right" style={{ color: "var(--good)" }}>{rlusd(p.available)}</div>
            <div className="mono text-right" style={{ color: "var(--fg-soft)" }}>{rlusd(p.drawn)}</div>
            <div className="mono text-right">{rlusd(p.first_loss_capital)}</div>
            <div className="mono text-right" style={{ color: "var(--fg-soft)" }}>{pct(p.first_loss_buffer)}</div>
          </div>
        ))}
      </div>

      {/* critical loans */}
      <SectionTitle>
        Critical loans
        {d.at_risk_loans.length > 0 && <span className="ml-2"><Pill tone="bad">{d.at_risk_loans.length}</Pill></span>}
      </SectionTitle>
      {d.at_risk_loans.length === 0 ? (
        <div className="exp-panel p-4 text-sm" style={{ color: "var(--fg-soft)" }}>
          No active loans are inside the grace / default window.
        </div>
      ) : (
        <div className="exp-panel">
          <div className="exp-row exp-head" style={{ gridTemplateColumns: "1.7fr 1fr 1.3fr 2.2fr" }}>
            <div>Loan</div><div className="text-right">Principal</div><div>Window</div><div>Actions</div>
          </div>
          {d.at_risk_loans.map((l) => (
            <div key={l.loan_id} className="exp-row" style={{ gridTemplateColumns: "1.7fr 1fr 1.3fr 2.2fr" }}>
              <div className="mono">#{l.loan_id} · pool {l.pool_key}</div>
              <div className="mono text-right">{rlusd(l.principal)}</div>
              <div>
                <Pill tone={l.in_grace ? "bad" : "warn"}>
                  {l.in_grace ? `grace · ${Math.abs(l.hours_to_default).toFixed(1)}h over` : `${l.hours_to_default.toFixed(1)}h to default`}
                </Pill>
                {l.grace_extra_hours > 0 && (
                  <span className="ml-2 text-[11px]" style={{ color: "var(--fg-soft)" }}>+{l.grace_extra_hours}h granted</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input className="input mono w-16 py-1" type="number" min="1"
                  value={hours[l.loan_id] || 1}
                  onChange={(e) => setHours({ ...hours, [l.loan_id]: e.target.value })} />
                <Button className="py-1.5" variant="ghost" onClick={() => extend(l.loan_id)}>Extend</Button>
                {l.in_grace && (
                  <Button className="py-1.5" onClick={() => defaultLoan(l.loan_id)}
                    style={{ background: "var(--bad)", color: "#fff" }}>Default</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* permissioned access list */}
      {acc?.permission && (
        <>
          <SectionTitle>Permissioned access list</SectionTitle>
          <div className="exp-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm" style={{ color: "var(--fg-soft)" }}>
                Borrowers are gated by an on-chain Permissioned Domain (XLS-80) and CoinFish
                Credentials (XLS-70), administered from the operator account.
              </div>
              <VerifyLink href={acc.permission.permission_list_explorer_url} label="View access list on XRPL" />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
              <KV k="Domain ID" v={acc.permission.domain_id} />
              <KV k="Issuer" v={acc.permission.issuer_address} href={acc.permission.issuer_explorer_url} />
              <KV k="Operator" v={acc.permission.operator_address} href={acc.permission.operator_explorer_url} />
            </div>
          </div>
        </>
      )}

      {/* per-pool access lists — each vault gates with its own credential + tier */}
      {acc?.pool_access?.length > 0 && (
        <>
          <SectionTitle>Per-pool access lists</SectionTitle>
          <div className="grid gap-4 md:grid-cols-3">
            {acc.pool_access.map((pa) => (
              <div key={pa.pool_key} className="exp-panel p-4">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm">{pa.name}</div>
                  <a href={pa.access_explorer_url} target="_blank" rel="noreferrer"
                    style={{ color: "var(--accent)", fontSize: "0.7rem", fontWeight: 700 }}>access list ↗</a>
                </div>
                <div className="mt-1 text-[11px] mono" style={{ color: "var(--fg-soft)" }}>{pa.credential_type}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {pa.eligible_tiers.map((t) => <Pill key={t} tone={t === pa.min_tier ? "accent" : "muted"}>{t}</Pill>)}
                </div>
                <div className="exp-head mt-3">Members ({pa.members.length})</div>
                <div className="mt-1 space-y-1">
                  {pa.members.length === 0 && <div className="text-[11px]" style={{ color: "var(--fg-soft)" }}>No eligible lenders yet.</div>}
                  {pa.members.map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span>{m.company_name}</span>
                      {m.account_explorer_url
                        ? <a className="mono" href={m.account_explorer_url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{m.tier} ↗</a>
                        : <span className="mono" style={{ color: "var(--fg-soft)" }}>{m.tier}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* participant registry: company detail + on-chain identity + position */}
      {acc?.accounts?.length > 0 && (
        <>
          <SectionTitle>
            Participants
            <span className="ml-2"><Pill tone="good">{acc.lenders} lenders</Pill></span>
            <span className="ml-1"><Pill tone="warn">{acc.borrowers} borrowers</Pill></span>
          </SectionTitle>
          <div className="exp-panel">
            <div className="exp-row exp-head" style={{ gridTemplateColumns: "1.6fr .7fr 1.5fr 1.6fr" }}>
              <div>Company</div><div>Role</div><div>On-chain identity</div><div className="text-right">Position</div>
            </div>
            {acc.accounts.map((a) => (
              <div key={a.id} className="exp-row" style={{ gridTemplateColumns: "1.6fr .7fr 1.5fr 1.6fr" }}>
                <div>
                  <div className="font-bold">{a.company_name}</div>
                  <div className="text-[11px]" style={{ color: "var(--fg-soft)" }}>{a.email} · KYC {a.kyc_status}</div>
                </div>
                <div><Pill tone={a.role === "lender" ? "good" : "warn"}>{a.role}</Pill></div>
                <div className="text-xs">
                  {a.xrpl_address ? (
                    <a className="mono" href={a.account_explorer_url} target="_blank" rel="noreferrer"
                      style={{ color: "var(--accent)" }}>
                      {a.xrpl_address.slice(0, 10)}…{a.xrpl_address.slice(-4)} ↗
                    </a>
                  ) : <span style={{ color: "var(--fg-soft)" }}>no wallet</span>}
                  {a.credential_explorer_url && (
                    <a className="ml-2" href={a.credential_explorer_url} target="_blank" rel="noreferrer"
                      style={{ color: "var(--fg-soft)" }}>credential ↗</a>
                  )}
                </div>
                <div className="text-right text-xs mono">
                  {a.lending
                    ? <span>{rlusd(a.lending.total_deposited)} supplied</span>
                    : <span>{usd(a.borrowing.collateral_pledged)} pledged · {rlusd(a.borrowing.outstanding)} borrowed</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionTitle>XRPL transaction ledger</SectionTitle>
      <TxLedger rows={txs} title="" />
    </Layout>
  );
}

function KV({ k, v, href }) {
  return (
    <div className="control-panel exp-panel p-2">
      <div className="exp-head">{k}</div>
      {href
        ? <a className="mono text-xs" href={href} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{(v || "—").slice(0, 22)}… ↗</a>
        : <div className="mono text-xs" style={{ color: "var(--fg)" }}>{(v || "—").slice(0, 26)}{v && v.length > 26 ? "…" : ""}</div>}
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="mt-7 mb-2 text-sm font-extrabold uppercase tracking-wider"
    style={{ color: "var(--fg-soft)" }}>{children}</h2>;
}

function Metric({ label, value, accent, tone, divider }) {
  return (
    <div className="p-4" style={{ borderRight: divider ? "1px solid var(--line)" : "none" }}>
      <div className="exp-head">{label}</div>
      <div className="mono mt-1 text-xl font-extrabold"
        style={{ color: tone ? `var(--${tone})` : accent ? "var(--accent)" : "var(--fg)" }}>
        {value}
      </div>
    </div>
  );
}

function UtilBar({ v }) {
  const pctv = Math.max(0, Math.min(1, v)) * 100;
  const tone = v > 0.85 ? "bad" : v > 0.6 ? "warn" : "good";
  return (
    <div className="h-2 flex-1" style={{ background: "color-mix(in srgb, var(--line) 60%, transparent)" }}>
      <div className="h-full" style={{ width: `${pctv}%`, background: `var(--${tone})`, transition: "width .6s ease" }} />
    </div>
  );
}

function RiskMeter({ score, band }) {
  const tone = band === "low" ? "good" : band === "critical" ? "bad" : "warn";
  const pctv = Math.max(0, Math.min(100, score));
  return (
    <div>
      <div className="relative h-3" style={{ background: "color-mix(in srgb, var(--line) 60%, transparent)" }}>
        <div className="h-full" style={{ width: `${pctv}%`, background: `var(--${tone})`, transition: "width .6s ease" }} />
        <div className="absolute top-0 bottom-0" style={{ left: `${pctv}%`, width: 2, background: "var(--fg)" }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs" style={{ color: "var(--fg-soft)" }}>
        <span className="mono">0</span>
        <span className="mono text-base font-extrabold" style={{ color: `var(--${tone})` }}>{Math.round(score)} / 100 · {band}</span>
        <span className="mono">100</span>
      </div>
    </div>
  );
}
