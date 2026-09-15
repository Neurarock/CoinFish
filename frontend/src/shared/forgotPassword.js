// Forgot / reset password for the shared company credential.
// Neon Auth sends an email OTP; local demo resets via /auth/password/reset.
import { api } from "./api.js";
import {
  neonAuthEnabled,
  neonRequestPasswordReset,
  neonResetPassword,
} from "./neonAuth.js";

export async function requestPasswordReset(email) {
  const trimmed = (email || "").trim();
  if (!trimmed) throw new Error("Work email is required.");
  if (neonAuthEnabled) {
    await neonRequestPasswordReset(trimmed);
    return { provider: "neon", email: trimmed };
  }
  // Demo has no mailer — advance the UI without revealing whether the email exists.
  return { provider: "demo", email: trimmed };
}

export async function resetAccountPassword({ email, otp, newPassword }) {
  const trimmed = (email || "").trim();
  if (!trimmed) throw new Error("Work email is required.");
  if (newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters.");
  }
  if (neonAuthEnabled) {
    const code = (otp || "").trim();
    if (code.length < 6) throw new Error("Enter the 6-digit code from your email.");
    await neonResetPassword({ email: trimmed, otp: code, password: newPassword });
    return { provider: "neon" };
  }
  await api.resetPassword({ email: trimmed, new_password: newPassword });
  return { provider: "demo" };
}
