// Borrower dashboard: how much borrowed, interest paid, outstanding, an itemised
// bill, and a wallet panel to RECEIVE RLUSD (QR, like the fiat top-up) so the
// borrower can fund repayments. Per active loan you can repay interest-only,
// repay ALL early (principal + interest up to the minimum term), or default.
import { useEffect, useState } from "react";
import { api } from "../api.js";
import Layout from "../components/Layout.jsx";
import TxLedger from "../components/TxLedger.jsx";
import QrCode from "../components/QrCode.jsx";
import { useTx } from "../components/TxProcessing.jsx";
import { Button, Stat, Pill, VerifyLink, IdentityLinks, rlusd, usd, pct } from "../components/ui.jsx";

export default function BorrowerDashboard() {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const [txs, setTxs] = useState([]);
  const [loadErr, setLoadErr] = useState("");
  const { track } = useTx();

  const load = () => {
    setLoadErr("");
    api.borrowerDashboard().then(setD).catch((e) => setLoadErr(e.message || "Could not load your dashboard."));
    api.myTransactions().then(setTxs).catch(() => setTxs([]));
  };
  useEffect(() => { load(); }, []);

  async function act(promise, loanId, meta) {
    setMsg(null);
    try {
      const r = await track(promise, meta);
      setMsg({ loanId, text: summarise(r), tone: "good", tx_hash: r.tx_hash, explorer_url: r.explorer_url });
      load();
    } catch (e) { setMsg({ loanId, text: e.message, tone: "bad" }); }
  }

  if (!d) return (
    <Layout role="borrower">
      {loadErr ? (
        <div className="card p-5">
          <div className="font-bold" style={{ color: "var(--bad)" }}>Couldn’t load your dashboard</div>
          <div className="mt-1 text-sm" style={{ color: "var(--fg-soft)" }}>
            {loadErr} If this is the deployed app, the backend likely isn’t keeping state — see the
            database setup notes.
          </div>
          <Button className="mt-3" onClick={load}>Retry</Button>
        </div>
      ) : (
        <div style={{ color: "var(--fg-soft)" }}>Loading…</div>
      )}
    </Layout>
  );

  return (
    <Layout role="borrower">
      <h1 className="text-3xl font-extrabold">
        <span className="morph-text">Borrowing dashboard</span>
      </h1>
      <div className="mt-5 grid gap-4 sm:grid-cols-4">
        <Stat label="Total borrowed" value={rlusd(d.total_borrowed)} />
        <Stat label="Outstanding" value={rlusd(d.outstanding)} accent />
        <Stat label="Interest paid" value={rlusd(d.interest_paid)} />
        <Stat label="Available collateral" value={usd(d.collateral_available)} />
      </div>

      <ReceiveWallet account={d.account} track={track} onCredited={load} />

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
            </div>
            <VerifyLink href={l.origination_explorer_url} hash={l.origination_tx} label="Verify origination on XRPL" />
            {l.xrpl_loan_id && (
              <div className="mt-1 text-[11px]" style={{ color: "var(--fg-soft)" }}>
                Loan object <span className="mono">{l.xrpl_loan_id.slice(0, 14)}…</span>
              </div>
            )}

            {l.status === "active" && l.payoff && (
              <div className="mt-3 rounded-xl p-3 text-xs" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
                <span className="font-bold" style={{ color: "var(--accent)" }}>Pay it all off: {rlusd(l.payoff.payoff_now)}</span>
                {" "}— principal {rlusd(l.principal)} + interest {rlusd(l.payoff.interest_due_now)}.
                {l.payoff.is_early
                  ? ` Early close still covers interest to the ${l.payoff.min_term_hours}h minimum term.`
                  : ` Interest accrued so far (${l.payoff.elapsed_hours}h held).`}
              </div>
            )}

            {l.status === "active" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => act(
                  api.repay(l.id, { mode: "interest" }), l.id,
                  { title: "Paying interest", steps: ["Building LoanPay", "Signing", "Submitting to XRPL", "Confirming"], success: "Interest paid" },
                )}>
                  Repay interest
                </Button>
                <Button onClick={() => act(
                  api.repay(l.id, { mode: "full" }), l.id,
                  { title: "Repaying loan in full", steps: ["Computing payoff to min term", "Building LoanPay", "Submitting to XRPL", "Releasing collateral"], success: "Loan repaid in full" },
                )}>
                  {l.payoff ? `Repay all early · ${rlusd(l.payoff.payoff_now)}` : "Repay all early"}
                </Button>
                <Button variant="ghost" className="ml-auto"
                  onClick={() => act(
                    api.defaultLoan(l.id), l.id,
                    { title: "Processing default", steps: ["Flagging loan", "LoanManage default", "Drawing first-loss cover", "Seizing collateral"], success: "Default processed" },
                  )}
                  style={{ color: "var(--bad)", borderColor: "var(--bad)" }}>
                  Default
                </Button>
              </div>
            )}
            {msg?.loanId === l.id && (
              <div className="mt-2 text-sm" style={{ color: `var(--${msg.tone})` }}>
                {msg.text}
                <VerifyLink href={msg.explorer_url} hash={msg.tx_hash} label="Verify on XRPL" />
              </div>
            )}
          </div>
        ))}
      </div>
      <TxLedger rows={txs} />
    </Layout>
  );
}

// Receive RLUSD into the connected wallet — same QR pattern as the fiat top-up,
// but on the XRPL side, so the borrower can fund repayments.
function ReceiveWallet({ account, track, onCredited }) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState(null);
  const [amount, setAmount] = useState(5000);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  async function show() {
    setErr("");
    try {
      const r = await api.receiveRlusd({ amount: Number(amount) || 0 });
      setInfo(r);
      setOpen(true);
    } catch (e) { setErr(e.message); }
  }
  // Mocks an incoming transfer from an external wallet, but actually credits
  // real RLUSD to the connected Devnet wallet so repayment can be tested.
  async function deposit() {
    setErr("");
    try {
      await track(
        api.depositRlusd({ amount: Number(amount) || 0 }),
        {
          title: "Receiving RLUSD",
          steps: ["Incoming transfer detected", "Issuing RLUSD on Devnet",
                  "Submitting to XRPL", "Crediting your wallet"],
          success: "RLUSD received",
        },
      );
      onCredited?.();
    } catch (e) { setErr(e.message); }
  }
  function copy() {
    navigator.clipboard?.writeText(info?.xrpl_address || account.xrpl_address || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="morph-edge mt-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-bold">Wallet</div>
          <div className="text-xs" style={{ color: "var(--fg-soft)" }}>
            {account.xrpl_address
              ? <>{account.xrpl_address.slice(0, 12)}…{account.xrpl_address.slice(-6)}</>
              : "No wallet connected"}
          </div>
          <IdentityLinks account={account} />
        </div>
        <div className="flex items-center gap-3">
          <Pill tone="good">{rlusd(account.wallet_rlusd_balance)}</Pill>
          <Button variant={open ? "ghost" : "primary"} onClick={() => (open ? setOpen(false) : show())}>
            {open ? "Hide" : "Deposit RLUSD"}
          </Button>
        </div>
      </div>

      {err && <div className="mt-2 text-sm" style={{ color: "var(--bad)" }}>{err}</div>}

      {open && info && (
        <div className="mt-4 flex flex-wrap items-start gap-5">
          <QrCode payload={info.qr_payload} />
          <div className="text-sm space-y-2">
            <div className="flex items-end gap-2">
              <label>
                <span className="text-xs font-semibold" style={{ color: "var(--fg-soft)" }}>Amount (RLUSD)</span>
                <input className="input mt-1 w-44" type="number" value={amount}
                  onChange={(e) => setAmount(e.target.value)} />
              </label>
              <Button variant="ghost" onClick={show}>Update QR</Button>
            </div>
            <Detail k="Network" v="XRPL Devnet" />
            <Detail k="Asset" v={info.currency} />
            <Detail k="Send to" v={`${info.xrpl_address.slice(0, 16)}…${info.xrpl_address.slice(-6)}`} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={deposit}>Simulate incoming transfer</Button>
              <Button variant="ghost" onClick={copy}>{copied ? "Copied ✓" : "Copy address"}</Button>
              <VerifyLink href={info.explorer_url} label="View account on XRPL" />
            </div>
            <div className="text-xs" style={{ color: "var(--fg-soft)" }}>
              “Simulate incoming transfer” credits real RLUSD to this wallet on Devnet
              (mocking an external sender) so you can test repayment.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function summarise(r) {
  if (r.mode === "interest") return `Interest paid: ${rlusd(r.interest_paid)}.`;
  if (r.mode === "full") {
    const tag = r.early ? ` (early — interest to ${r.min_term_hours}h minimum term)` : "";
    return `Loan repaid in full: ${rlusd(r.payoff_total)}${tag}. Collateral released.`;
  }
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
function Detail({ k, v }) {
  return (
    <div className="flex justify-between gap-6">
      <span style={{ color: "var(--fg-soft)" }}>{k}</span>
      <span className="font-bold">{v}</span>
    </div>
  );
}
