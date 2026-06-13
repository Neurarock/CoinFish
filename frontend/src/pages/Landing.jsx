// Home: login / signup for both roles. Signup collects company details (for show
// only — no real verification), then the KYC button (+ credit check for
// borrowers) flips orange->green, then connect wallet, then enter the app.
// The page re-themes live to match the selected role.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store.jsx";
import { api } from "../api.js";
import { Button, Field, Pill } from "../components/ui.jsx";
import CheckButton from "../components/CheckButton.jsx";

const THEME = { lender: "theme-lender", borrower: "theme-borrower" };

export default function Landing() {
  const { login, patchAccount, account } = useAuth();
  const nav = useNavigate();
  const [role, setRole] = useState("lender");
  const [mode, setMode] = useState("signup");
  const [form, setForm] = useState({ company_name: "", company_number: "", contact_name: "", email: "", password: "" });
  const [acct, setAcct] = useState(account || null);
  const [wallet, setWallet] = useState(null);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const needCredit = role === "borrower";
  const kycDone = acct?.kyc_status === "passed";
  const creditDone = !needCredit || acct?.credit_status === "passed";
  const ready = acct && kycDone && creditDone && wallet;

  async function doSignup(e) {
    e.preventDefault();
    setErr("");
    try {
      const r = await api.signup({ ...form, role });
      login(r.token, r.account);
      setAcct(r.account);
    } catch (e) { setErr(e.message); }
  }
  async function doLogin(e) {
    e.preventDefault();
    setErr("");
    try {
      const r = await api.login({ email: form.email, password: form.password });
      login(r.token, r.account);
      enter(r.account);
    } catch (e) { setErr(e.message); }
  }
  async function connect() {
    const w = await api.connectWallet();
    setWallet(w);
  }
  function enter(a = acct) {
    if (a.role === "lender") nav("/lender/deposit");
    else nav("/borrower/collateral");
  }

  return (
    <div className={`app-bg ${THEME[role]} min-h-screen flex flex-col`}>
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2 text-xl font-extrabold">
          <span className="text-2xl">🐟</span> CoinFish
        </div>
        <a href="/vault" className="text-sm font-semibold" style={{ color: "var(--fg-soft)" }}>
          CoinFish vault ↗
        </a>
      </div>

      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-6 py-8 md:grid-cols-2">
        {/* pitch side */}
        <div className="space-y-4">
          <h1 className="text-4xl font-extrabold leading-tight">
            Fiat-rich, crypto-poor?<br />Borrow on-chain in seconds.
          </h1>
          <p style={{ color: "var(--fg-soft)" }}>
            Lenders supply RLUSD into risk-tiered pools and earn yield. Borrowers post
            fiat collateral off-chain and draw instant stablecoin loans on the XRP Ledger.
          </p>
          <div className="flex gap-2">
            <RoleTab cur={role} val="lender" set={setRole} label="I'm a Lender" sub="bright & liquid" />
            <RoleTab cur={role} val="borrower" set={setRole} label="I'm a Borrower" sub="fast & black" />
          </div>
        </div>

        {/* form side */}
        <div className="card p-6">
          <div className="mb-4 flex gap-2 text-sm">
            <TabBtn on={mode === "signup"} onClick={() => setMode("signup")}>Sign up</TabBtn>
            <TabBtn on={mode === "login"} onClick={() => setMode("login")}>Log in</TabBtn>
            <span className="ml-auto"><Pill tone={role === "lender" ? "accent" : "muted"}>{role}</Pill></span>
          </div>

          {mode === "login" ? (
            <form onSubmit={doLogin} className="space-y-3">
              <Field label="Work email" type="email" value={form.email} onChange={set("email")} required />
              <Field label="Password" type="password" value={form.password} onChange={set("password")} required />
              <Button className="w-full justify-center">Log in</Button>
            </form>
          ) : !acct ? (
            <form onSubmit={doSignup} className="space-y-3">
              <Field label="Company name" value={form.company_name} onChange={set("company_name")} required />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Company no." value={form.company_number} onChange={set("company_number")} />
                <Field label="Contact name" value={form.contact_name} onChange={set("contact_name")} />
              </div>
              <Field label="Work email" type="email" value={form.email} onChange={set("email")} required />
              <Field label="Password" type="password" value={form.password} onChange={set("password")} required />
              <Button className="w-full justify-center">Create account</Button>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="text-sm" style={{ color: "var(--fg-soft)" }}>
                Welcome, <b style={{ color: "var(--fg)" }}>{acct.company_name}</b>. Finish onboarding:
              </div>
              <CheckButton label="KYC" done={kycDone}
                onPass={async () => patchAndStore(await api.verifyKyc())} />
              {needCredit && (
                <CheckButton label="credit" done={creditDone}
                  onPass={async () => patchAndStore(await api.verifyCredit())} />
              )}
              <Button variant={wallet ? "ghost" : "primary"} className="w-full justify-center"
                onClick={connect} disabled={!!wallet}>
                {wallet ? `✓ Wallet ${wallet.xrpl_address.slice(0, 10)}…` : "Connect wallet"}
              </Button>
              <Button className="w-full justify-center" disabled={!ready} onClick={() => enter()}>
                Enter {role} app →
              </Button>
            </div>
          )}
          {err && <div className="mt-3 text-sm" style={{ color: "var(--bad)" }}>{err}</div>}
        </div>
      </div>
    </div>
  );

  function patchAndStore(next) {
    setAcct(next);
    patchAccount(next);
  }
}

function RoleTab({ cur, val, set, label, sub }) {
  const on = cur === val;
  return (
    <button onClick={() => set(val)} className="card flex-1 p-3 text-left"
      style={{ outline: on ? "2px solid var(--accent)" : "none" }}>
      <div className="font-bold">{label}</div>
      <div className="text-xs" style={{ color: "var(--fg-soft)" }}>{sub}</div>
    </button>
  );
}
function TabBtn({ on, ...p }) {
  return <button {...p} className="rounded-full px-3 py-1 font-semibold"
    style={{ background: on ? "var(--accent)" : "transparent", color: on ? "var(--accent-fg)" : "var(--fg-soft)" }} />;
}
