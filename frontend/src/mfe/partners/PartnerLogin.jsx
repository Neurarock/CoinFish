// Placeholder Partner Portal login — client-only demo session.
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Logo from "../../shared/components/Logo.jsx";
import { isPartnerAuthed, isPartnerEnrolled, enrollPartner, setPartnerSession } from "./session.js";
import { api, setToken } from "../../shared/api.js";

export default function PartnerLogin() {
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", org_id: "" });
  const [err, setErr] = useState("");

  if (isPartnerAuthed()) {
    return <Navigate to="/partners/home" replace />;
  }

  function submit(e, enroll) {
    e.preventDefault();
    setErr("");
    if (!form.email.trim() || !form.password.trim()) {
      setErr("Email and password are required.");
      return;
    }
    const email = form.email.trim();
    if (!enroll && !isPartnerEnrolled(email)) {
      setErr("This email isn’t a partner yet. Click Become a partner to enroll — we don’t add partner access automatically.");
      return;
    }
    if (enroll) enrollPartner(email);
    setPartnerSession({
      email,
      org_id: form.org_id.trim() || "demo-org",
      at: Date.now(),
    });
    const cfToken = sessionStorage.getItem("cf_token");
    if (enroll && cfToken) {
      setToken(cfToken);
      api.enableAccess({ role: "partner" }).catch(() => {});
    }
    nav("/partners/home");
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
          <h1>Sign in</h1>
          <p className="partners-lede">
            Integrator access for API keys, usage, and commissions.
            Sign in if you already enrolled. New firms click Become a partner —
            nothing is enrolled automatically.
          </p>

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
            <button type="submit" className="partners-btn partners-btn-primary">
              Sign in
            </button>
            <button
              type="button"
              className="partners-btn partners-btn-ghost"
              onClick={(e) => submit(e, true)}
            >
              Become a partner
            </button>
          </form>

          <p className="partners-hint">
            Placeholder only · partner auth is local to this browser
          </p>
        </div>
      </main>
    </div>
  );
}
