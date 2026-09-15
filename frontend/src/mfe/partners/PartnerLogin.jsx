// Partner Portal login — Neon Auth when configured, else demo /auth/login.
// Same email/password as Launch App so the company credential stays in sync.
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Logo from "../../shared/components/Logo.jsx";
import ForgotPasswordForm from "../../shared/components/ForgotPasswordForm.jsx";
import { useAuth } from "../../shared/store.jsx";
import { api } from "../../shared/api.js";
import {
  neonAuthEnabled,
  neonEmailSignIn,
  neonJwt,
  neonMessage,
  needsEmailVerification,
} from "../../shared/neonAuth.js";
import { isPartnerAuthed, isPartnerEnrolled, enrollPartner, setPartnerSession } from "./session.js";

export default function PartnerLogin() {
  const nav = useNavigate();
  const { login, patchAccount } = useAuth();
  const [form, setForm] = useState({ email: "", password: "", org_id: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  if (isPartnerAuthed()) {
    return <Navigate to="/partners/home" replace />;
  }

  async function submit(e, enroll) {
    e.preventDefault();
    setErr("");
    if (!form.email.trim() || !form.password.trim()) {
      setErr("Email and password are required.");
      return;
    }
    const email = form.email.trim();
    setBusy(true);
    try {
      let account;
      if (neonAuthEnabled) {
        let jwt;
        try {
          jwt = await neonEmailSignIn(email, form.password);
        } catch (ex) {
          if (needsEmailVerification(ex)) {
            throw new Error("Verify your email in Launch App first, then return here.");
          }
          throw new Error(neonMessage(ex));
        }
        try {
          const r = await api.neonSession({ token: await neonJwt(jwt) });
          login(r.token, r.account);
          account = r.account;
        } catch (ex) {
          if (/company name is required/i.test(ex.message || "")) {
            throw new Error(
              "Finish Launch App signup with this email first, then become a partner.",
            );
          }
          throw ex;
        }
      } else {
        const r = await api.login({ email, password: form.password });
        login(r.token, r.account);
        account = r.account;
      }

      if (enroll) {
        if (!account.can_partner) {
          const next = await api.enableAccess({ role: "partner" });
          patchAccount(next);
          account = next;
        }
        enrollPartner(email);
      } else if (!account.can_partner && !isPartnerEnrolled(email)) {
        throw new Error(
          "This email isn’t a partner yet. Click Become a partner to enroll — we don’t add partner access automatically.",
        );
      } else {
        enrollPartner(email);
      }

      setPartnerSession({
        email,
        org_id: form.org_id.trim() || "demo-org",
        at: Date.now(),
      });
      nav("/partners/home");
    } catch (ex) {
      setErr(ex.message || String(ex));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="partners-page">
      <header className="partners-nav">
        <Link to="/" className="partners-brand">
          <Logo size={40} aura={false} />
          <span>CoinFish</span>
        </Link>
        <nav className="partners-nav-links">
          <Link to="/">Company</Link>
          <Link to="/app">Launch App</Link>
        </nav>
      </header>

      <main className="partners-main">
        <div className="partners-panel">
          <p className="partners-kicker">Partner Portal</p>
          <h1>{forgot ? "Reset password" : "Sign in"}</h1>
          <p className="partners-lede">
            {forgot
              ? "Reset the shared company password used for lender, borrower, and partner."
              : "Integrator access for API keys, usage, and commissions. Use the same work email and password as Launch App — one company credential for lender, borrower, and partner."}
          </p>

          {forgot ? (
            <ForgotPasswordForm
              variant="partners"
              initialEmail={form.email}
              onBack={() => { setForgot(false); setErr(""); }}
              onDone={() => { setForgot(false); setErr(""); }}
            />
          ) : (
            <form className="partners-form" onSubmit={(e) => submit(e, false)}>
              <label>
                <span>Work email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@firm.com"
                  required
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  required
                />
              </label>
              <div className="partners-forgot-row">
                <button
                  type="button"
                  className="partners-text-btn"
                  onClick={() => { setForgot(true); setErr(""); }}
                >
                  Forgot password?
                </button>
              </div>
              <label>
                <span>Organisation ID <em>(optional)</em></span>
                <input
                  type="text"
                  value={form.org_id}
                  onChange={(e) => setForm({ ...form, org_id: e.target.value })}
                  placeholder="demo-org"
                />
              </label>
              {err && <p className="partners-err">{err}</p>}
              <button type="submit" className="partners-btn partners-btn-primary" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
              <button
                type="button"
                className="partners-btn partners-btn-ghost"
                disabled={busy}
                onClick={(e) => submit(e, true)}
              >
                Become a partner
              </button>
            </form>
          )}

          <p className="partners-hint">
            {neonAuthEnabled
              ? "Password is managed by Neon Auth · shared with Launch App"
              : "Same password as Launch App for this company email"}
          </p>
        </div>
      </main>
    </div>
  );
}
