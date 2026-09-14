import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(frontendDir, "..");

// Neon sets `__Secure-neonauth.session_token; Secure; SameSite=None`. On the
// HTTP Vite origin that cookie is dropped unless we downgrade it, and Neon
// then ignores the downgraded name unless we restore `__Secure-` on the way back.
export function rewriteNeonSetCookie(cookie) {
  let next = String(cookie)
    .replace(/;\s*Domain=[^;]*/gi, "")
    .replace(/;\s*Secure/gi, "")
    .replace(/;\s*Partitioned/gi, "")
    .replace(/;\s*SameSite=[^;]*/gi, "")
    .replace(/;\s*Path=[^;]*/gi, "; Path=/");
  if (!/;\s*SameSite=/i.test(next)) next += "; SameSite=Lax";
  if (next.startsWith("__Secure-")) next = next.slice("__Secure-".length);
  if (next.startsWith("__Host-")) next = next.slice("__Host-".length);
  return next;
}

export function rewriteNeonCookieHeader(cookieHeader) {
  if (!cookieHeader) return cookieHeader;
  return String(cookieHeader).split(/;\s*/).flatMap((part) => {
    const name = part.split("=")[0];
    if (!name || name.startsWith("__Secure-") || name.startsWith("__Host-")) return [part];
    if (/^(neonauth|better-auth)\./i.test(name) || /session_token/i.test(name)) {
      return [part, `__Secure-${part}`];
    }
    return [part];
  }).join("; ");
}

// The FastAPI backend runs on :8000; proxy /api there in dev so the frontend
// can call the same-origin paths used in src/api.js. Neon Auth env vars live
// in the repo-root .env (VITE_NEON_AUTH_URL is public; JWKS stays server-side).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  const neonAuth = (env.NEON_AUTH_BASE_URL || env.VITE_NEON_AUTH_URL || "").replace(/\/$/, "");
  const proxy = {
    "/api": {
      target: "http://localhost:8000",
      changeOrigin: true,
      timeout: 180_000,
      proxyTimeout: 180_000,
      rewrite: (p) => p.replace(/^\/api/, ""),
    },
  };
  if (neonAuth && !neonAuth.startsWith("/")) {
    proxy["/neon-auth"] = {
      target: neonAuth,
      changeOrigin: true,
      rewrite: (p) => p.replace(/^\/neon-auth/, "") || "/",
      configure: (p) => {
        p.on("proxyReq", (proxyReq, req) => {
          const rewritten = rewriteNeonCookieHeader(req.headers.cookie);
          if (rewritten) proxyReq.setHeader("cookie", rewritten);
        });
        p.on("proxyRes", (proxyRes) => {
          const cookies = proxyRes.headers["set-cookie"];
          if (!cookies) return;
          const list = Array.isArray(cookies) ? cookies : [cookies];
          proxyRes.headers["set-cookie"] = list.map(rewriteNeonSetCookie);
        });
      },
    };
  }
  return {
    plugins: [react()],
    envDir: repoRoot,
    server: {
      port: 5173,
      proxy,
    },
  };
});
