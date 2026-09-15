// Shared forgot-password for Launch App and Partner Portal.
// Neon Auth: email OTP → new password. Demo: email → new password (no mailer).
import { useEffect, useState } from "react";
import { requestPasswordReset, resetAccountPassword } from "../forgotPassword.js";
import { neonAuthEnabled } from "../neonAuth.js";
import { Button, Field } from "./ui.jsx";

export default function ForgotPasswordForm({
  variant = "app",
  initialEmail = "",
  onBack,
  onDone,
}) {
  const [step, setStep] = useState("request"); // request | reset | done
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function sendCode(e) {
    e?.preventDefault?.();
    setErr("");
    setBusy(true);
    try {
      const r = await requestPasswordReset(email);
      setEmail(r.email);
      setOtp("");
      setStep("reset");
      if (r.provider === "neon") setResendIn(30);
    } catch (ex) {
      setErr(ex.message || String(ex));
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(e) {
    e.preventDefault();
    setErr("");
    if (newPassword !== confirmPassword) {
      setErr("New password and confirmation do not match.");
      return;
    }
    setBusy(true);
    try {
      await resetAccountPassword({
        email,
        otp,
        newPassword,
      });
      setStep("done");
      setNewPassword("");
      setConfirmPassword("");
      setOtp("");
    } catch (ex) {
      setErr(ex.message || String(ex));
    } finally {
      setBusy(false);
    }
  }

  if (variant === "partners") {
    if (step === "done") {
      return (
        <div className="partners-form">
          <p className="partners-ok">
            Password updated. It applies to lender, borrower, and partner sign-in for this email.
          </p>
          <button type="button" className="partners-btn partners-btn-primary" onClick={onDone}>
            Back to sign in
          </button>
        </div>
      );
    }

    if (step === "reset") {
      return (
        <form className="partners-form" onSubmit={submitReset}>
          <p className="partners-hint" style={{ marginTop: 0, textAlign: "left" }}>
            {neonAuthEnabled
              ? <>Enter the code sent to <strong>{email}</strong>, then choose a new password.</>
              : <>Demo mode — no email is sent. Set a new password for <strong>{email}</strong>.</>}
          </p>
          {neonAuthEnabled ? (
            <label>
              <span>One-time code</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
              />
            </label>
          ) : null}
          <label>
            <span>New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setErr(""); }}
              minLength={8}
              required
            />
          </label>
          <label>
            <span>Confirm new password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setErr(""); }}
              minLength={8}
              required
            />
          </label>
          {err ? <p className="partners-err">{err}</p> : null}
          <button
            type="submit"
            className="partners-btn partners-btn-primary"
            disabled={busy || (neonAuthEnabled && otp.length < 6)}
          >
            {busy ? "Updating…" : "Reset password"}
          </button>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
            <button type="button" className="partners-text-btn" onClick={onBack}>
              Back to sign in
            </button>
            {neonAuthEnabled ? (
              <button
                type="button"
                className="partners-text-btn"
                disabled={busy || resendIn > 0}
                onClick={() => sendCode()}
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </button>
            ) : null}
          </div>
        </form>
      );
    }

    return (
      <form className="partners-form" onSubmit={sendCode}>
        <p className="partners-hint" style={{ marginTop: 0, textAlign: "left" }}>
          {neonAuthEnabled
            ? "We’ll email a one-time code to reset the shared company password."
            : "Local demo has no mailer — continue to set a new password for this email."}
        </p>
        <label>
          <span>Work email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErr(""); }}
            placeholder="you@firm.com"
            required
          />
        </label>
        {err ? <p className="partners-err">{err}</p> : null}
        <button type="submit" className="partners-btn partners-btn-primary" disabled={busy}>
          {busy
            ? (neonAuthEnabled ? "Sending…" : "Continuing…")
            : (neonAuthEnabled ? "Send reset code" : "Continue")}
        </button>
        <button type="button" className="partners-btn partners-btn-ghost" onClick={onBack}>
          Back to sign in
        </button>
      </form>
    );
  }

  if (step === "done") {
    return (
      <div className="space-y-3">
        <p className="text-sm" style={{ color: "var(--good)" }}>
          Password updated. It applies to lender, borrower, and partner sign-in for this email.
        </p>
        <Button type="button" className="w-full justify-center" onClick={onDone}>
          Back to log in
        </Button>
      </div>
    );
  }

  if (step === "reset") {
    return (
      <form onSubmit={submitReset} className="space-y-3">
        <p className="text-sm" style={{ color: "var(--fg-soft)" }}>
          {neonAuthEnabled
            ? <>Enter the code sent to <b style={{ color: "var(--fg)" }}>{email}</b>, then choose a new password.</>
            : <>Demo mode — no email is sent. Set a new password for <b style={{ color: "var(--fg)" }}>{email}</b>.</>}
        </p>
        {neonAuthEnabled ? (
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
        ) : null}
        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => { setNewPassword(e.target.value); setErr(""); }}
          minLength={8}
          required
        />
        <Field
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value); setErr(""); }}
          minLength={8}
          required
        />
        {err ? <p className="text-sm" style={{ color: "var(--bad)" }}>{err}</p> : null}
        <Button
          className="w-full justify-center"
          disabled={busy || (neonAuthEnabled && otp.length < 6)}
        >
          {busy ? "Updating…" : "Reset password"}
        </Button>
        <div className="flex items-center justify-between text-xs" style={{ color: "var(--fg-soft)" }}>
          <button
            type="button"
            className="underline-offset-2 hover:underline"
            onClick={onBack}
          >
            Back to log in
          </button>
          {neonAuthEnabled ? (
            <button
              type="button"
              disabled={busy || resendIn > 0}
              className="underline-offset-2 hover:underline disabled:no-underline disabled:opacity-60"
              onClick={() => sendCode()}
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
            </button>
          ) : null}
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="space-y-3">
      <p className="text-sm" style={{ color: "var(--fg-soft)" }}>
        {neonAuthEnabled
          ? "We’ll email a one-time code to reset the shared company password."
          : "Local demo has no mailer — continue to set a new password for this email."}
      </p>
      <Field
        label="Work email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); setErr(""); }}
        required
      />
      {err ? <p className="text-sm" style={{ color: "var(--bad)" }}>{err}</p> : null}
      <Button className="w-full justify-center" disabled={busy}>
        {busy
          ? (neonAuthEnabled ? "Sending…" : "Continuing…")
          : (neonAuthEnabled ? "Send reset code" : "Continue")}
      </Button>
      <button
        type="button"
        className="block w-full text-center text-xs underline-offset-2 hover:underline"
        style={{ color: "var(--fg-soft)" }}
        onClick={onBack}
      >
        Back to log in
      </button>
    </form>
  );
}
