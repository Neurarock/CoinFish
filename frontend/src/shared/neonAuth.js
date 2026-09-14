// Neon Managed Better Auth client. When VITE_NEON_AUTH_URL is unset, the app
// keeps the demo email/password API so local/CI still work.
import { createAuthClient } from "@neondatabase/neon-js/auth";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

const remoteUrl = (import.meta.env.VITE_NEON_AUTH_URL || "").trim().replace(/\/$/, "");
// Vite proxies /neon-auth → Neon so set-auth-jwt is readable same-origin.
// Better Auth requires an absolute URL; a bare "/neon-auth" throws and blanks /app.
// Production talks to Neon directly (Vercel cannot rewrite an env-specific Auth URL).
const url = remoteUrl && import.meta.env.DEV
  ? `${typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:5173"}/neon-auth`
  : remoteUrl;

export const neonAuthEnabled = Boolean(remoteUrl);

export const authClient = url
  ? createAuthClient(url, {
      adapter: BetterAuthReactAdapter(),
      fetchOptions: { credentials: "include" },
    })
  : null;

export function neonMessage(resultOrErr) {
  if (!resultOrErr) return "Authentication failed";
  if (typeof resultOrErr === "string") return resultOrErr;
  const err = resultOrErr.error || resultOrErr;
  if (typeof err === "string") return err;
  return err.message || err.statusText || err.error || "Authentication failed";
}

function errCode(resultOrErr) {
  if (!resultOrErr || typeof resultOrErr === "string") return "";
  const err = resultOrErr.error || resultOrErr;
  return String(err.code || err.body?.code || "");
}

export function needsEmailVerification(resultOrErr) {
  const code = errCode(resultOrErr);
  if (code === "EMAIL_NOT_VERIFIED" || code === "email_not_confirmed") return true;
  return /verif/i.test(neonMessage(resultOrErr));
}

function isJwt(token) {
  return typeof token === "string" && token.split(".").length === 3;
}

function jwtFromAuthResult(result, headerJwt = "") {
  const session = result?.data?.session || result?.session;
  for (const candidate of [
    headerJwt,
    session?.access_token,
    result?.data?.token,
    session?.token,
  ]) {
    if (isJwt(candidate)) return candidate;
  }
  return "";
}

function withJwtCapture(onJwt) {
  return {
    credentials: "include",
    onSuccess: (ctx) => {
      const header = ctx.response?.headers?.get("set-auth-jwt") || "";
      if (header) onJwt(header);
    },
  };
}

export async function neonJwt(preferred) {
  if (!authClient) throw new Error("Neon Auth is not configured");
  if (isJwt(preferred)) return preferred;
  try {
    const direct = await authClient.token();
    if (isJwt(direct.data?.token)) return direct.data.token;
  } catch (err) {
    const msg = neonMessage(err);
    const code = errCode(err);
    const noSession = /unauthor|session|jwt|credential/i.test(msg)
      || ["bad_jwt", "invalid_credentials", "session_not_found"].includes(code);
    if (!noSession) throw err;
  }
  let headerJwt = "";
  const session = await authClient.getSession({
    fetchOptions: withJwtCapture((jwt) => { headerJwt = jwt; }),
  });
  const fromSession = jwtFromAuthResult(session, headerJwt);
  if (fromSession) return fromSession;
  throw new Error("Could not read a session token from Neon Auth");
}

export async function neonEmailSignIn(email, password) {
  if (!authClient) throw new Error("Neon Auth is not configured");
  let headerJwt = "";
  const result = await authClient.signIn.email({
    email,
    password,
    fetchOptions: withJwtCapture((jwt) => { headerJwt = jwt; }),
  });
  if (result?.error) throw new Error(neonMessage(result));
  return jwtFromAuthResult(result, headerJwt) || neonJwt();
}

export async function neonVerifySignupOtp({ email, otp, password }) {
  if (!authClient) throw new Error("Neon Auth is not configured");
  let headerJwt = "";
  try {
    const result = await authClient.emailOtp.verifyEmail({
      email,
      otp,
      fetchOptions: withJwtCapture((jwt) => { headerJwt = jwt; }),
    });
    if (result?.error) throw result.error;
    const fromVerify = jwtFromAuthResult(result, headerJwt);
    if (fromVerify) return fromVerify;
  } catch (err) {
    const code = errCode(err);
    const msg = neonMessage(err);
    // First submit often verifies the email, then the JWT fetch 401s. Retrying
    // the same code then returns Invalid OTP; password sign-in still works.
    if (code !== "INVALID_OTP" && !/invalid otp|otp is invalid/i.test(msg)) throw new Error(msg);
  }
  try {
    return await neonEmailSignIn(email, password);
  } catch (err) {
    if (needsEmailVerification(err)) {
      throw new Error("That code is incorrect or expired. Try again or request a new one.");
    }
    throw err instanceof Error ? err : new Error(neonMessage(err));
  }
}

export async function neonSignOut() {
  if (!authClient) return;
  try {
    await authClient.signOut();
  } catch {
    /* already signed out */
  }
}
