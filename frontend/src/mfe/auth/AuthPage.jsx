// Launch App mini-frontend: login / signup for lenders and borrowers.
// Signup collects company details, verifies work email with a Neon Auth OTP,
// then KYC (+ credit for borrowers), wallet connect, then the product worlds.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../shared/store.jsx";
import { api } from "../../shared/api.js";
import {
  authClient,
  neonAuthEnabled,
  requireEmailOtp,
  OTP_REQUIRED_MESSAGE,
  neonEmailSignIn,
  neonJwt,
  neonMessage,
  neonVerifySignupOtp,
  needsEmailVerification,
} from "../../shared/neonAuth.js";
import { Button, Field, Pill, VerifyLink, rlusd } from "../../shared/components/ui.jsx";
import CheckButton from "../../shared/components/CheckButton.jsx";
import DevnetBadge from "../../shared/components/DevnetBadge.jsx";
import Logo from "../../shared/components/Logo.jsx";
import { useTx } from "../../shared/components/TxProcessing.jsx";

const THEME = { lender: "theme-lender", borrower: "theme-borrower" };

export default function AuthPage() {
  const { login, patchAccount, account } = useAuth();
  const { track } = useTx();
  const nav = useNavigate();
  const [role, setRole] = useState("lender");
  const [mode, setMode] = useState("signup");
  const [form, setForm] = useState({ company_name: "", company_number: "", contact_name: "", email: "", password: "", lender_tier: "retail" });
  const [acct, setAcct] = useState(account || null);
  const [wallet, setWallet] = useState(null);
  const [walletChoice, setWalletChoice] = useState("xaman");
  const [walletAddress, setWalletAddress] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpPending, setOtpPending] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [pendingJwt, setPendingJwt] = useState("");
  const [devnet, setDevnet] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const needCredit = (acct?.role || role) === "borrower";
  const kycDone = acct?.kyc_status === "passed";
  useEffect(() => {
    if (!account) return undefined;
    setAcct(account);
    if (account.role === "lender" || account.role === "borrower") setRole(account.role);
  }, [account]);
  useEffect(() => {
    if (!account) return undefined;
    let cancelled = false;
    api.me().then((next) => {
      if (cancelled || !next) return;
      patchAccount(next);
      setAcct(next);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [account?.id]);
  useEffect(() => {
    let cancelled = false;
    api.runtimeStatus().then((status) => {
      if (!cancelled) setDevnet(status);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const creditDone = !needCredit || acct?.credit_status === "passed";
  const connectedWallet = wallet || (acct?.wallet_connected ? {
    xrpl_address: acct.xrpl_address,
    provider: acct.wallet_provider,
    rlusd_balance: acct.wallet_rlusd_balance,
    explorer_url: acct.wallet_explorer_url,
  } : null);
  const ready = acct && kycDone && creditDone && connectedWallet;

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function beginOtp(email) {
    setOtpEmail(email);
    setOtp("");
    setOtpPending(true);
    setResendIn(30);
  }

  async function exchangeNeon(extra = {}, token) {
    const jwt = await neonJwt(token);
    const r = await api.neonSession({ token: jwt, ...extra });
    login(r.token, r.account);
    return r.account;
  }

  function neonProfile() {
    return {
      role,
      company_name: form.company_name,
      contact_name: form.contact_name,
      company_number: form.company_number,
      lender_tier: form.lender_tier,
    };
  }

  async function finishNeon(jwt) {
    const next = await exchangeNeon(neonProfile(), jwt);
    const creditOk = next.role !== "borrower" || next.credit_status === "passed";
    if (next.wallet_connected && next.kyc_status === "passed" && creditOk) {
      enter(next);
      return next;
    }
    setAcct(next);
    return next;
  }

  async function doSignup(e) {
    e.preventDefault();
    setErr("");
    if (!pendingJwt && requireEmailOtp && form.password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      if (pendingJwt) {
        await finishNeon(pendingJwt);
        setPendingJwt("");
        return;
      }
      if (!neonAuthEnabled) {
        if (requireEmailOtp) throw new Error(OTP_REQUIRED_MESSAGE);
        const r = await api.signup({ ...form, role });
        login(r.token, r.account);
        setAcct(r.account);
        return;
      }
      const name = form.contact_name.trim() || form.company_name.trim();
      const result = await authClient.signUp.email({
        name,
        email: form.email,
        password: form.password,
      });
      if (result.error) throw new Error(neonMessage(result));
      await beginOtp(form.email);
    } catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }

  async function doLogin(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (!neonAuthEnabled) {
        if (requireEmailOtp) throw new Error(OTP_REQUIRED_MESSAGE);
        const r = await api.login({ email: form.email, password: form.password });
        login(r.token, r.account);
        enter(r.account);
        return;
      }
      let jwt;
      try {
        jwt = await neonEmailSignIn(form.email, form.password);
      } catch (ex) {
        if (needsEmailVerification(ex)) {
          await authClient.emailOtp.sendVerificationOtp({
            email: form.email,
            type: "email-verification",
          });
          await beginOtp(form.email);
          return;
        }
        throw ex;
      }
      try {
        await finishNeon(jwt);
      } catch (ex) {
        if (needsEmailVerification(ex)) {
          await authClient.emailOtp.sendVerificationOtp({
            email: form.email,
            type: "email-verification",
          });
          await beginOtp(form.email);
          return;
        }
        if (/company name is required/i.test(ex.message)) {
          setPendingJwt(jwt);
          setMode("signup");
          setErr("Add your company name to finish this " + role + " account.");
          return;
        }
        throw ex;
      }
    } catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }

  async function doVerifyOtp(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const jwt = await neonVerifySignupOtp({
        email: otpEmail,
        otp: otp.trim(),
        password: form.password,
      });
      await finishNeon(jwt);
      setOtpPending(false);
    } catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }

  async function resendOtp() {
    if (resendIn > 0 || !authClient) return;
    setErr("");
    setBusy(true);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: otpEmail,
        type: "email-verification",
      });
      if (result.error) throw new Error(neonMessage(result));
      setResendIn(30);
    } catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }

  async function connect() {
    setErr("");
    let w;
    try {
      w = await track(
        api.connectWallet({ provider: walletChoice, address: walletAddress }),
        {
          title: "Connecting your XRPL wallet",
          steps: [
            "Opening " + walletChoice + " signer",
            "Funding a Devnet faucet wallet",
            "Setting the RLUSD trustline",
            "Minting demo RLUSD",
            "Issuing credentials on Devnet",
            "Reading RLUSD balance",
          ],
          success: "Wallet connected",
        },
      );
    } catch (e) { setErr(e.message); return; }
    setWallet(w);
    const next = {
      ...acct,
      xrpl_address: w.xrpl_address,
      wallet_provider: w.provider,
      wallet_rlusd_balance: w.rlusd_balance,
      wallet_explorer_url: w.explorer_url,
      wallet_connected: true,
    };
    setAcct(next);
    patchAccount(next);
  }
  function enter(a = acct) {
    if (a.role === "lender") nav("/lender/deposit");
    else nav("/borrower/collateral");
  }

  return (
    <div className={`home-page app-bg ${THEME[role]} min-h-screen flex flex-col`}>
      <div className="flex items-center justify-between gap-4 px-6 py-4 md:px-8">
        <div className="flex items-center gap-3 text-[1.05rem] font-semibold tracking-tight">
          <Logo size={44} to="/" />
          <span>CoinFish</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link to="/vault" className="app-vault-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="app-vault-badge-icon">
              <path
                fill="currentColor"
                d="M12 2.25a4.75 4.75 0 0 0-4.75 4.75V9H6.4A2.15 2.15 0 0 0 4.25 11.15v7.4A2.15 2.15 0 0 0 6.4 20.7h11.2a2.15 2.15 0 0 0 2.15-2.15v-7.4A2.15 2.15 0 0 0 17.6 9h-1.85V7A4.75 4.75 0 0 0 12 2.25ZM9.35 7A2.65 2.65 0 0 1 12 4.35 2.65 2.65 0 0 1 14.65 7v2H9.35V7ZM12 13.1a1.7 1.7 0 0 1 .85 3.18v1.22a.85.85 0 0 1-1.7 0v-1.22A1.7 1.7 0 0 1 12 13.1Z"
              />
            </svg>
            Vault
            <span aria-hidden="true" className="app-vault-badge-arrow">↗</span>
          </Link>
          <span className="hidden sm:inline-flex">
            <DevnetBadge />
          </span>
        </div>
      </div>

      <div className="mx-auto flex w-full min-w-0 max-w-md flex-1 flex-col items-center justify-center gap-5 px-6 py-10 md:px-8">
        <RoleToggle role={role} setRole={setRole} />
        <div className="card w-full min-w-0 p-6 md:p-7">
          <div className="mb-5 flex gap-2 text-sm">
            {!acct && (
              <>
                <TabBtn on={mode === "signup"} onClick={() => { setMode("signup"); setOtpPending(false); setErr(""); }}>Sign up</TabBtn>
                <TabBtn on={mode === "login"} onClick={() => { setMode("login"); setOtpPending(false); setErr(""); }}>Log in</TabBtn>
              </>
            )}
            <span className={acct ? "" : "ml-auto"}><Pill tone={(acct?.role || role) === "lender" ? "accent" : "muted"}>{acct?.role || role}</Pill></span>
          </div>

          {otpPending ? (
            <form onSubmit={doVerifyOtp} className="space-y-3">
              <div className="text-sm" style={{ color: "var(--fg-soft)" }}>
                Enter the 6-digit code we sent to{" "}
                <b style={{ color: "var(--fg)" }}>{otpEmail}</b> to confirm this email.
              </div>
              <Field
                label="One-time code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
              />
              <Button className="w-full justify-center" disabled={busy || otp.length < 6}>
                {busy ? "Verifying…" : "Verify email"}
              </Button>
              <div className="flex items-center justify-between text-xs" style={{ color: "var(--fg-soft)" }}>
                <button
                  type="button"
                  className="underline-offset-2 hover:underline"
                  onClick={() => { setOtpPending(false); setOtp(""); setErr(""); }}
                >
                  Use a different email
                </button>
                <button
                  type="button"
                  disabled={busy || resendIn > 0}
                  className="underline-offset-2 hover:underline disabled:no-underline disabled:opacity-60"
                  onClick={resendOtp}
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                </button>
              </div>
            </form>
          ) : acct ? (
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
              <WalletConnect
                wallet={connectedWallet}
                choice={walletChoice}
                setChoice={setWalletChoice}
                address={walletAddress}
                setAddress={setWalletAddress}
                onConnect={connect}
                blocked={Boolean(devnet && !devnet.devnet_ready)}
                warnings={devnet?.warnings || []}
              />
              <Button className="w-full justify-center" disabled={!ready} onClick={() => enter()}>
                Enter {acct.role || role} app →
              </Button>
            </div>
          ) : mode === "login" ? (
            <form onSubmit={doLogin} className="space-y-3">
              <Field label="Work email" type="email" value={form.email} onChange={set("email")} required />
              <Field label="Password" type="password" value={form.password} onChange={set("password")} required />
              <Button className="w-full justify-center" disabled={busy}>
                {busy ? "Signing in…" : "Log in"}
              </Button>
            </form>
          ) : (
            <form onSubmit={doSignup} className="space-y-3">
              <Field label="Company name" value={form.company_name} onChange={set("company_name")} required />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Company no." value={form.company_number} onChange={set("company_number")} />
                <Field label="Contact name" value={form.contact_name} onChange={set("contact_name")} />
              </div>
              <Field label="Work email" type="email" value={form.email} onChange={set("email")} required />
              {!pendingJwt && (
              <Field
                label="Password"
                type="password"
                value={form.password}
                onChange={set("password")}
                minLength={requireEmailOtp ? 8 : undefined}
                required
              />
              )}
              {role === "lender" && (
                <label className="block space-y-1.5">
                  <span
                    className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em]"
                    style={{ color: "var(--fg-soft)" }}
                  >
                    Accreditation tier
                  </span>
                  <span className="app-select-wrap">
                    <select
                      className="app-select"
                      value={form.lender_tier}
                      onChange={set("lender_tier")}
                    >
                      <option value="retail">Retail — Conservative pool only</option>
                      <option value="professional">Professional — Conservative + Balanced</option>
                      <option value="institutional">Institutional — all pools</option>
                    </select>
                  </span>
                </label>
              )}
              <Button className="w-full justify-center" disabled={busy}>
                {pendingJwt
                  ? (busy ? "Saving…" : "Finish account")
                  : (busy ? "Sending code…" : requireEmailOtp ? "Send verification code" : "Create account")}
              </Button>
              {!neonAuthEnabled && !requireEmailOtp && (
                <p className="text-xs" style={{ color: "var(--fg-soft)" }}>
                  Email OTP is off until Neon Auth is configured.
                </p>
              )}
              {requireEmailOtp && !neonAuthEnabled && (
                <p className="text-xs" style={{ color: "var(--bad)" }}>
                  {OTP_REQUIRED_MESSAGE}
                </p>
              )}
            </form>
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

function RoleToggle({ role, setRole }) {
  return (
    <div className="role-toggle" data-role={role} role="tablist" aria-label="Account type">
      <span className="role-toggle-thumb" aria-hidden="true" />
      <button
        type="button"
        role="tab"
        aria-selected={role === "lender"}
        onClick={() => setRole("lender")}
      >
        Lender
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={role === "borrower"}
        onClick={() => setRole("borrower")}
      >
        Borrower
      </button>
    </div>
  );
}
function TabBtn({ on, ...p }) {
  return (
    <button
      {...p}
      type="button"
      className="rounded-full px-3.5 py-1.5 text-sm font-medium tracking-tight"
      style={{
        background: on ? "var(--accent)" : "transparent",
        color: on ? "var(--accent-fg)" : "var(--fg-soft)",
      }}
    />
  );
}

const PROVIDERS = [
  ["xaman", "Xaman", "Mobile sign request"],
  ["crossmark", "Crossmark", "Browser extension"],
  ["gemwallet", "GemWallet", "Browser wallet"],
  ["devnet", "Devnet signer", "Demo faucet wallet"],
];

function WalletConnect({
  wallet,
  choice,
  setChoice,
  address,
  setAddress,
  onConnect,
  blocked = false,
  warnings = [],
}) {
  if (wallet) {
    return (
      <div className="rounded-lg p-3" style={{ border: "1px solid var(--line)", background: "var(--bg)" }}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold" style={{ color: "var(--fg-soft)" }}>
              Connected wallet · {wallet.provider || "xrpl"}
            </div>
            <div className="font-bold">{wallet.xrpl_address.slice(0, 12)}…{wallet.xrpl_address.slice(-6)}</div>
          </div>
          <Pill tone="good">{rlusd(wallet.rlusd_balance)}</Pill>
        </div>
        <VerifyLink href={wallet.explorer_url} label="View account on XRPL" />
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-lg p-3" style={{ border: "1px solid var(--line)", background: "var(--bg)" }}>
      <div className="text-xs font-semibold" style={{ color: "var(--fg-soft)" }}>
        Connect XRPL signer
      </div>
      <div className="grid grid-cols-2 gap-2">
        {PROVIDERS.map(([id, name, sub]) => (
          <button key={id} type="button" onClick={() => setChoice(id)}
            className="rounded-lg border p-2 text-left"
            style={{
              borderColor: choice === id ? "var(--accent)" : "var(--line)",
              background: choice === id ? "color-mix(in srgb, var(--accent) 10%, var(--bg-soft))" : "var(--bg-soft)",
            }}>
            <div className="text-sm font-bold">{name}</div>
            <div className="text-[11px]" style={{ color: "var(--fg-soft)" }}>{sub}</div>
          </button>
        ))}
      </div>
      <Field
        label="Wallet address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Devnet faucet wallet is created if empty"
      />
      {blocked && warnings.length > 0 && (
        <p className="text-xs" style={{ color: "var(--bad)" }}>
          Wallet connection needs a complete Devnet setup: {warnings.join("; ")}
        </p>
      )}
      <Button className="w-full justify-center" onClick={onConnect} disabled={blocked}>
        Approve sign-in and connect
      </Button>
    </div>
  );
}
