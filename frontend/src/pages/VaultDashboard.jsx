// CoinFish's own dashboard (swimming-pool blue). Shows fee revenue, solvency
// (with an "underwater" overlay effect when liabilities exceed assets), a risk
// gauge, per-pool saturation, and the CRITICAL section: loans inside the grace
// window about to default, each with a control to extend grace by N hours.
import { useEffect, useState } from "react";
import { api } from "../api.js";
import Layout from "../components/Layout.jsx";
import PoolWater from "../components/PoolWater.jsx";
import { Button, Stat, Pill, rlusd, pct } from "../components/ui.jsx";

export default function VaultDashboard() {
  const [d, setD] = useState(null);
  const [hours, setHours] = useState({});

  const load = () => api.adminDashboard().then(setD);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  async function extend(loan_id) {
    await api.extendGrace({ loan_id, hours: Number(hours[loan_id] || 1) });
    load();
  }

  if (!d) return <Layout role="admin"><div>Loading…</div></Layout>;

  return (
    <Layout role="admin">
      {d.underwater && <Underwater />}
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold">CoinFish vault</h1>
          <Pill tone={d.underwater ? "bad" : "good"}>
            {d.underwater ? "⚠ underwater" : "buoyant"} · solvency {d.solvency_ratio}×
          </Pill>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          <Stat label="Fees collected" value={rlusd(d.fees_collected)} accent />
          <Stat label="Total TVL" value={rlusd(d.total_tvl)} />
          <Stat label="Out on loan" value={rlusd(d.total_drawn)} />
          <Stat label="First-loss capital" value={rlusd(d.total_first_loss)} />
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <div className="card p-5 md:col-span-1">
            <div className="font-bold">Risk score</div>
            <RiskGauge score={d.risk_score} band={d.risk_band} />
          </div>
          <div className="md:col-span-2 grid gap-5 sm:grid-cols-3">
            {d.pools.map((p) => (
              <div key={p.key} className="card p-4">
                <div className="font-bold text-sm">{p.name}</div>
                <div className="my-2">
                  <PoolWater level={p.utilisation} height={110} label="utilised" />
                </div>
                <div className="text-xs" style={{ color: "var(--fg-soft)" }}>
                  TVL {rlusd(p.tvl)} · cover {pct(p.first_loss_buffer)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* critical section */}
        <h2 className="mt-8 mb-3 text-xl font-bold">
          Critical · loans in grace window
          {d.at_risk_loans.length > 0 && <span className="ml-2"><Pill tone="bad">{d.at_risk_loans.length}</Pill></span>}
        </h2>
        {d.at_risk_loans.length === 0 ? (
          <div className="card p-5" style={{ color: "var(--fg-soft)" }}>
            Nothing about to default. Calm waters. 🐟
          </div>
        ) : (
          <div className="space-y-3">
            {d.at_risk_loans.map((l) => (
              <div key={l.loan_id} className="card p-4"
                style={{ borderColor: l.in_grace ? "var(--bad)" : "var(--warn)" }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold">
                    Loan #{l.loan_id} · {rlusd(l.principal)} · pool {l.pool_key}
                  </div>
                  <Pill tone={l.in_grace ? "bad" : "warn"}>
                    {l.in_grace ? `in grace · ${Math.abs(l.hours_to_default).toFixed(1)}h over` : `${l.hours_to_default.toFixed(1)}h to default`}
                  </Pill>
                </div>
                <div className="mt-3 flex items-end gap-2">
                  <label>
                    <span className="text-xs font-semibold" style={{ color: "var(--fg-soft)" }}>Extend grace (hours)</span>
                    <input className="input mt-1 w-28" type="number" min="1"
                      value={hours[l.loan_id] || 1}
                      onChange={(e) => setHours({ ...hours, [l.loan_id]: e.target.value })} />
                  </label>
                  <Button onClick={() => extend(l.loan_id)}>Grant extension</Button>
                  {l.grace_extra_hours > 0 && (
                    <span className="text-xs self-center" style={{ color: "var(--fg-soft)" }}>
                      +{l.grace_extra_hours}h already granted
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function RiskGauge({ score, band }) {
  const tone = band === "low" ? "good" : band === "critical" ? "bad" : "warn";
  const r = 54, c = Math.PI * r; // half circle
  const frac = score / 100;
  return (
    <div className="mt-3 flex flex-col items-center">
      <svg width="150" height="90" viewBox="0 0 150 90">
        <path d="M15 80 A60 60 0 0 1 135 80" fill="none" stroke="var(--line)" strokeWidth="12" strokeLinecap="round" />
        <path d="M15 80 A60 60 0 0 1 135 80" fill="none" stroke={`var(--${tone})`} strokeWidth="12"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
      </svg>
      <div className="-mt-4 text-3xl font-extrabold" style={{ color: `var(--${tone})` }}>{score}</div>
      <Pill tone={tone}>{band}</Pill>
    </div>
  );
}

// Full-bleed rising-water overlay when the platform is underwater.
function Underwater() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-x-0 bottom-0 h-2/3 animate-bob"
        style={{ background: "linear-gradient(180deg, rgba(2,40,70,0.25), rgba(2,40,70,0.55))" }} />
      <div className="absolute left-10 bottom-10 text-4xl animate-swim">🐟</div>
      <div className="absolute left-0 bottom-24 text-2xl animate-swim" style={{ animationDelay: "3s" }}>🐠</div>
    </div>
  );
}
