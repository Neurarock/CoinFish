// Lender deposit screen: three pools, each with full financial disclosure, a
// water tank showing how saturated it is (utilisation), and a deposit panel.
import { useEffect, useState } from "react";
import { api } from "../api.js";
import Layout from "../components/Layout.jsx";
import PoolWater from "../components/PoolWater.jsx";
import { useTx } from "../components/TxProcessing.jsx";
import { Button, Pill, VerifyLink, rlusd, pct } from "../components/ui.jsx";

export default function LenderDeposit() {
  const [pools, setPools] = useState([]);
  const [sel, setSel] = useState(null);
  const [amount, setAmount] = useState(10000);
  const [msg, setMsg] = useState(null);
  const { track } = useTx();

  const load = () => api.pools().then(setPools);
  useEffect(() => { load(); }, []);

  async function deposit() {
    setMsg(null);
    try {
      const r = await track(
        api.deposit({ pool_key: sel, amount: Number(amount) }),
        {
          title: "Depositing into the vault",
          steps: ["Building VaultDeposit", "Signing", "Submitting to XRPL", "Minting your vault shares"],
          success: "Deposit confirmed",
        },
      );
      setMsg({
        text: `Deposited. Wallet balance ${rlusd(r.wallet_balance)}.`,
        tx_hash: r.tx_hash,
        explorer_url: r.explorer_url,
      });
      load();
    } catch (e) { setMsg({ error: e.message }); }
  }

  return (
    <Layout role="lender">
      <h1 className="text-3xl font-extrabold">Choose a pool to fund</h1>
      <p className="mt-1 mb-6" style={{ color: "var(--fg-soft)" }}>
        Deposits supply RLUSD to a Single Asset Vault and mint you vault shares. Yield accrues
        as borrowers pay interest. Capital out on loan returns within one 24-hour term.
      </p>

      <Disclaimer />

      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {pools.map((p) => (
          <div key={p.key} className="card p-4"
            style={{ outline: sel === p.key ? "2px solid var(--accent)" : "none" }}>
            <div className="flex items-center justify-between">
              <div className="font-bold">{p.name}</div>
              <Pill tone={p.risk_tier === "low" ? "good" : p.risk_tier === "high" ? "bad" : "warn"}>
                {p.risk_tier} risk
              </Pill>
            </div>
            <div className="my-3">
              <PoolWater level={p.utilisation} height={130}
                label="lent out" sublabel={`${rlusd(p.drawn)} of ${rlusd(p.tvl)}`} />
            </div>
            <Row k="Target APR (net)" v={pct(p.net_apr)} accent />
            <Row k="Base APR" v={pct(p.base_apr)} />
            <Row k="First-loss buffer" v={pct(p.first_loss_buffer)} />
            <Row k="First-loss capital" v={rlusd(p.first_loss_capital)} />
            <Row k="Idle / available" v={rlusd(p.available)} />
            <div className="mt-3 flex flex-wrap gap-2">
              <VerifyLink href={p.vault_explorer_url} hash={p.vault_id} label="Verify vault" />
              <VerifyLink href={p.loan_broker_explorer_url} hash={p.loan_broker_id} label="Verify broker" />
            </div>
            <Button variant={sel === p.key ? "primary" : "ghost"} className="mt-3 w-full justify-center"
              onClick={() => setSel(p.key)}>
              {sel === p.key ? "Selected" : "Select pool"}
            </Button>
          </div>
        ))}
      </div>

      {sel && (
        <div className="card mt-6 p-5">
          <div className="font-bold">Deposit into {pools.find((p) => p.key === sel)?.name}</div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex-1">
              <span className="text-xs font-semibold" style={{ color: "var(--fg-soft)" }}>Amount (RLUSD)</span>
              <input className="input mt-1" type="number" value={amount}
                onChange={(e) => setAmount(e.target.value)} />
            </label>
            <Button onClick={deposit}>Connect wallet & deposit</Button>
          </div>
          {msg && (
            <div className="mt-3 text-sm" style={{ color: msg.error ? "var(--bad)" : "var(--accent)" }}>
              {msg.error || msg.text}
              <VerifyLink
                href={msg.explorer_url}
                hash={msg.tx_hash}
                label="Verify on XRPL"
              />
            </div>
          )}
        </div>
      )}
    </Layout>
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

function Disclaimer() {
  return (
    <div className="card p-4 text-xs leading-relaxed" style={{ color: "var(--fg-soft)" }}>
      <b style={{ color: "var(--fg)" }}>Risk notice.</b> Deposits are not bank deposits and are not
      covered by the FSCS. Capital is at risk. Yield is variable and not guaranteed. Withdrawals are
      served from idle pool liquidity; if a pool is heavily utilised, exits are queued fairly (FIFO)
      and settle as loans repay, within one 24-hour loan term. First-loss capital absorbs initial
      losses but does not eliminate the risk of loss. This is a Devnet demonstration using a stand-in
      stablecoin — not a live financial product.
    </div>
  );
}
