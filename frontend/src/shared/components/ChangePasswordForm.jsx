// Shared password change for lender, borrower, and partner surfaces.
// Neon Auth (or the demo /auth/password API) is the single credential store.
import { useState } from "react";
import { changeAccountPassword } from "../changePassword.js";
import { neonAuthEnabled } from "../neonAuth.js";
import { Button, Field } from "./ui.jsx";

export default function ChangePasswordForm({ variant = "app" }) {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const set = (k) => (e) => {
    setForm((prev) => ({ ...prev, [k]: e.target.value }));
    setErr("");
    setOk("");
  };

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setOk("");
    if (form.newPassword !== form.confirmPassword) {
      setErr("New password and confirmation do not match.");
      return;
    }
    setBusy(true);
    try {
      await changeAccountPassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setOk(
        neonAuthEnabled
          ? "Password updated. It applies to lender, borrower, and partner sign-in for this email."
          : "Password updated for this company account (lender, borrower, and partner).",
      );
    } catch (ex) {
      setErr(ex.message || String(ex));
    } finally {
      setBusy(false);
    }
  }

  if (variant === "partners") {
    return (
      <form className="partners-form" onSubmit={submit}>
        <label>
          <span>Current password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={set("currentPassword")}
            required
          />
        </label>
        <label>
          <span>New password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={set("newPassword")}
            minLength={8}
            required
          />
        </label>
        <label>
          <span>Confirm new password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={set("confirmPassword")}
            minLength={8}
            required
          />
        </label>
        {err ? <p className="partners-err">{err}</p> : null}
        {ok ? <p className="partners-ok">{ok}</p> : null}
        <button type="submit" className="partners-btn partners-btn-primary" disabled={busy}>
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    );
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <Field
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={form.currentPassword}
        onChange={set("currentPassword")}
        required
      />
      <Field
        label="New password"
        type="password"
        autoComplete="new-password"
        value={form.newPassword}
        onChange={set("newPassword")}
        minLength={8}
        required
      />
      <Field
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        value={form.confirmPassword}
        onChange={set("confirmPassword")}
        minLength={8}
        required
      />
      {err ? <p className="text-sm" style={{ color: "var(--bad)" }}>{err}</p> : null}
      {ok ? <p className="text-sm" style={{ color: "var(--good)" }}>{ok}</p> : null}
      <Button className="w-full justify-center sm:w-auto" disabled={busy}>
        {busy ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
