// Lender dashboard: deposited positions with live water-saturation, accrued
// yield, and a withdraw control that either settles immediately or shows the
// exit-queue status when pool liquidity is short.
import { useEffect, useState } from "react";
import { api } from "../api.js";
import Layout from "../components/Layout.jsx";
import PoolWater from "../components/PoolWater.jsx";
import TxLedger from "../components/TxLedger.jsx";
import { Button, Stat, Pill, VerifyLink, rlusd, pct } from "../components/ui.jsx";

export default function LenderDashboard() {
  const [d, setD] = useState(null);
  const [wd, setWd] = useState({});
  const [msg, setMsg] = useState(null);
  const [txs, setTxs] = useState([]);

  const load = () => {
    api.lenderDashboard().then(setD);
    api.myTransactions().then(setTxs).catch(() => setTxs([]));
  };
  useEffect(() => { load(); }, []);

  async function withdraw(pool_key) {
    setMsg(null);
    try {
      const r = await api.withdraw({ pool_key, amount: Number(wd[pool_key] || 0) });
      setMsg({ pool_key, ...r });
      load();
    } catch (e) { setMsg({ pool_key, error: e.message }); }
  }

  if (!d) return <Layout role="lender"><div>Loading…</div></Layout>;

  return (
    <Layout role="lender">
      <h1 className="text-3xl font-extrabold">Your lending dashboard</h1>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Stat label="Total deposited" value={rlusd(d.total_deposited)} />
        <Stat label="Vault shares" value={d.total_shares.toLocaleString()} />
        <Stat label="Accrued yield (est.)" value={rlusd(d.accrued_yield)} accent />
      </div>

      <h2 className="mt-8 mb-3 text-xl font-bold">Positions</h2>
      {d.positions.length === 0 && (
        <div className="card p-5" style={{ color: "var(--fg-soft)" }}>
          No positions yet — fund a pool from the Deposit tab.
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        {d.positions.map((p) => (
          <div key={p.key} className="card p-4">
            <div className="flex items-center justify-between">
              <div className="font-bold">{p.name}</div>
              <Pill tone={p.utilisation > 0.85 ? "bad" : p.utilisation > 0.6 ? "warn" : "good"}>
                {pct(p.utilisation)} utilised
              </Pill>
            </div>
            <div className="my-3">
              <PoolWater level={p.utilisation} height={120}
                label="pool saturation" sublabel={`idle ${rlusd(p.available)}`} />
            </div>
            <Row k="Your principal" v={rlusd(p.your_principal)} />
            <Row k="Your yield (est.)" v={rlusd(p.your_yield)} accent />
            <div className="mt-3 flex items-end gap-2">
              <input className="input" type="number" placeholder="amount"
                value={wd[p.key] || ""} onChange={(e) => setWd({ ...wd, [p.key]: e.target.value })} />
              <Button variant="ghost" onClick={() => withdraw(p.key)}>Withdraw</Button>
            </div>
            {msg?.pool_key === p.key && <WithdrawMsg msg={msg} />}
          </div>
        ))}
      </div>

      {d.exit_queue.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-xl font-bold">Exit queue</h2>
          <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
            {d.exit_queue.map((e, i) => (
              <div key={i} className="flex items-center justify-between p-3 text-sm">
                <span>{e.pool_key} · requested {rlusd(e.amount_requested)}</span>
                <span className="flex items-center gap-2">
                  filled {rlusd(e.amount_filled)}
                  <Pill tone={e.status === "filled" ? "good" : e.status === "partial" ? "warn" : "muted"}>
                    {e.status}
                  </Pill>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <TxLedger rows={txs} />
    </Layout>
  );
}

function WithdrawMsg({ msg }) {
  if (msg.error) return <div className="mt-2 text-sm" style={{ color: "var(--bad)" }}>{msg.error}</div>;
  const tone = msg.queued ? "var(--warn)" : "var(--good)";
  return (
    <div className="mt-2 text-sm" style={{ color: tone }}>
      <div>{msg.message} Wallet balance {rlusd(msg.wallet_balance)}.</div>
      {(msg.tx_hashes || []).map((hash, i) => {
        const href = msg.explorer_urls?.[i];
        return (
          <VerifyLink
            key={hash}
            href={href}
            hash={hash}
            label="Verify on XRPL"
          />
        );
      })}
    </div>
  );
}
function Row({ k, v, accent }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span style={{ color: "var(--fg-soft)" }}>{k}</span>
      <span className="font-bold" style={{ color: accent ? "var(--accent)" : "var(--fg)" }}>{v}</span>
    </div>
  );
}
