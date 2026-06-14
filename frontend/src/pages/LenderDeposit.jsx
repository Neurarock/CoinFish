// Lender deposit screen: three pools, each with full financial disclosure, a
// water tank showing how saturated it is (utilisation), and a deposit panel.
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../store.jsx";
import Layout from "../components/Layout.jsx";
import PoolWater from "../components/PoolWater.jsx";
import { useTx } from "../components/TxProcessing.jsx";
import { Button, Pill, VerifyLink, rlusd, pct } from "../components/ui.jsx";

export default function LenderDeposit() {
  const { account } = useAuth();
  const tier = account?.lender_tier || "retail";
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

      <div className="mb-4 text-sm" style={{ color: "var(--fg-soft)" }}>
        Your accreditation: <Pill tone="accent">{tier}</Pill> — each pool is permissioned, so
        you can only fund pools your tier is cleared for.
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {pools.map((p) => {
          const eligible = (p.eligible_tiers || []).includes(tier);
          return (
          <div key={p.key} className="card p-4"
            style={{ outline: sel === p.key ? "2px solid var(--accent)" : "none", opacity: eligible ? 1 : 0.7 }}>
            <div className="flex items-center justify-between">
              <div className="font-bold">{p.name}</div>
              <Pill tone={eligible ? (p.risk_tier === "low" ? "good" : p.risk_tier === "high" ? "bad" : "warn") : "muted"}>
                {eligible ? `${p.risk_tier} risk` : "locked"}
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
            <Row k="Min tier" v={p.min_tier} />
            <div className="mt-3">
              <VerifyLink href={p.vault_explorer_url} label="Verify on XRPL" />
              <div className="mt-1 text-[11px]" style={{ color: "var(--fg-soft)" }}>
                {p.vault_id || p.loan_broker_id ? (
                  <>
                    {p.vault_id && <>vault <span className="mono">{p.vault_id.slice(0, 10)}…</span></>}
                    {p.vault_id && p.loan_broker_id && " · "}
                    {p.loan_broker_id && <>broker <span className="mono">{p.loan_broker_id.slice(0, 10)}…</span></>}
                  </>
                ) : (
                  <span>Devnet pool IDs not configured on this backend.</span>
                )}
              </div>
            </div>
            <Button variant={sel === p.key ? "primary" : "ghost"} className="mt-3 w-full justify-center"
              disabled={!eligible} onClick={() => eligible && setSel(p.key)}>
              {!eligible ? `Requires ${p.min_tier} tier` : sel === p.key ? "Selected" : "Select pool"}
            </Button>
          </div>
          );
        })}
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
