// Placeholder Partner Portal login — client-only demo session.
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Logo from "../../shared/components/Logo.jsx";
import { isPartnerAuthed, setPartnerSession } from "./session.js";

export default function PartnerLogin() {
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", org_id: "" });
  const [err, setErr] = useState("");

  if (isPartnerAuthed()) {
    return <Navigate to="/partners/home" replace />;
  }

  function submit(e) {
    e.preventDefault();
    setErr("");
    if (!form.email.trim() || !form.password.trim()) {
      setErr("Email and password are required.");
      return;
    }
    setPartnerSession({
      email: form.email.trim(),
      org_id: form.org_id.trim() || "demo-org",
      at: Date.now(),
    });
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
            This demo accepts any credentials — nothing is verified yet.
          </p>

          <form className="partners-form" onSubmit={submit}>
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
              Enter portal
            </button>
          </form>

          <p className="partners-hint">
            Placeholder only · no backend partner auth in this build
          </p>
        </div>
      </main>
    </div>
  );
}
