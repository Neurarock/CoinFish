// Borrower collateral screen (black theme). Top up fiat collateral via a
// simulated UK bank transfer (sort code / account / reference + QR), or withdraw
// unlocked collateral. Collateral level drives borrowing eligibility.
import { useEffect, useState } from "react";
import { api } from "../api.js";
import Layout from "../components/Layout.jsx";
import QrCode from "../components/QrCode.jsx";
import { Button, Stat, gbp } from "../components/ui.jsx";

export default function BorrowerCollateral() {
  const [d, setD] = useState(null);
  const [amount, setAmount] = useState(50000);
  const [intent, setIntent] = useState(null);
  const [wAmount, setWAmount] = useState(0);
  const [msg, setMsg] = useState("");

  const load = () => api.borrowerDashboard().then(setD);
  useEffect(() => { load(); }, []);

  async function startTopup() {
    setMsg("");
    setIntent(await api.topupIntent({ amount: Number(amount) }));
  }
  async function confirmTopup() {
    await api.topupConfirm({ amount: intent.amount });
    setIntent(null);
    setMsg("Transfer received — collateral credited.");
    load();
  }
  async function withdraw() {
    setMsg("");
    try {
      const r = await api.withdrawCollateral({ amount: Number(wAmount) });
      setMsg(r.message);
      load();
    } catch (e) { setMsg(e.message); }
  }

  if (!d) return <Layout role="borrower"><div>Loading…</div></Layout>;

  return (
    <Layout role="borrower">
      <h1 className="text-3xl font-extrabold">Collateral</h1>
      <p className="mt-1 mb-6" style={{ color: "var(--fg-soft)" }}>
        Your fiat deposit is held off-chain by CoinFish as collateral. It backs your on-chain
        loans and is secured by sovereign law — never touches the ledger.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total collateral" value={gbp(d.collateral)} />
        <Stat label="Locked behind loans" value={gbp(d.collateral_locked)} />
        <Stat label="Available" value={gbp(d.collateral_available)} accent />
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {/* top up */}
        <div className="card p-5">
          <div className="font-bold">Top up collateral</div>
          {!intent ? (
            <div className="mt-3 flex items-end gap-3">
              <label className="flex-1">
                <span className="text-xs font-semibold" style={{ color: "var(--fg-soft)" }}>Amount (GBP)</span>
                <input className="input mt-1" type="number" value={amount}
                  onChange={(e) => setAmount(e.target.value)} />
              </label>
              <Button onClick={startTopup}>Get transfer details</Button>
            </div>
          ) : (
            <div className="mt-4 flex gap-4">
              <QrCode payload={intent.qr_payload} />
              <div className="text-sm space-y-1">
                <Detail k="Pay to" v={intent.account_name} />
                <Detail k="Sort code" v={intent.sort_code} />
                <Detail k="Account no." v={intent.account_number} />
                <Detail k="Reference" v={intent.reference} />
                <Detail k="Amount" v={gbp(intent.amount)} />
                <Button className="mt-2 w-full justify-center" onClick={confirmTopup}>
                  I've sent the transfer
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* withdraw */}
        <div className="card p-5">
          <div className="font-bold">Withdraw collateral</div>
          <p className="mt-1 text-xs" style={{ color: "var(--fg-soft)" }}>
            Only unlocked collateral ({gbp(d.collateral_available)}) can be withdrawn.
          </p>
          <div className="mt-3 flex items-end gap-3">
            <label className="flex-1">
              <span className="text-xs font-semibold" style={{ color: "var(--fg-soft)" }}>Amount (GBP)</span>
              <input className="input mt-1" type="number" value={wAmount}
                onChange={(e) => setWAmount(e.target.value)} />
            </label>
            <Button variant="ghost" onClick={withdraw}>Withdraw</Button>
          </div>
        </div>
      </div>
      {msg && <div className="mt-4 text-sm" style={{ color: "var(--accent)" }}>{msg}</div>}
    </Layout>
  );
}

function Detail({ k, v }) {
  return (
    <div className="flex justify-between gap-6">
      <span style={{ color: "var(--fg-soft)" }}>{k}</span>
      <span className="font-bold">{v}</span>
    </div>
  );
}
