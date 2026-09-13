// Small shared UI atoms used across all themed mini-frontends.
export function Button({ variant = "primary", className = "", ...p }) {
  const v = variant === "primary" ? "btn-primary" : "btn-ghost";
  return <button className={`btn ${v} ${className}`} {...p} />;
}

export function Field({ label, ...p }) {
  return (
    <label className="block space-y-1.5">
      <span
        className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "var(--fg-soft)" }}
      >
        {label}
      </span>
      <input className="input" {...p} />
    </label>
  );
}

export function Stat({ label, value, accent }) {
  return (
    <div className="card p-5">
      <div
        className="text-[0.68rem] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "var(--fg-soft)" }}
      >
        {label}
      </div>
      <div
        className="mt-2 text-[1.65rem] font-bold tracking-tight"
        style={{ color: accent ? "var(--accent)" : "var(--fg)" }}
      >
        {value}
      </div>
    </div>
  );
}

export function VerifyLink({ href, hash, label = "Verify on XRPL" }) {
  if (!href) return null;
  return (
    <a className="verify-link" href={href} target="_blank" rel="noreferrer">
      <span className="verify-dot" />
      <span>{label}</span>
      {hash && <code>{hash.slice(0, 10)}…</code>}
    </a>
  );
}

// A user's on-chain identity IS their XRPL account (their public key / address).
// Borrowers additionally hold an XLS-70 Credential issued by CoinFish.
export function IdentityLinks({ account }) {
  if (!account?.xrpl_address) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <VerifyLink href={account.wallet_explorer_url} hash={account.xrpl_address} label="On-chain identity" />
      {account.credential_explorer_url && (
        <VerifyLink href={account.credential_explorer_url} hash={account.credential_id} label="Credential (XLS-70)" />
      )}
    </div>
  );
}

export function Pill({ children, tone = "accent" }) {
  const map = {
    accent: ["var(--accent)", "var(--accent-fg)"],
    good: ["var(--good)", "#fff"],
    warn: ["var(--warn)", "#241a00"],
    bad: ["var(--bad)", "#fff"],
    muted: ["var(--line)", "var(--fg-soft)"],
  };
  const [bg, fg] = map[tone] || map.accent;
  return <span className="pill" style={{ background: bg, color: fg }}>{children}</span>;
}

export const usd = (n) =>
  "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
// Back-compat alias: collateral used to be GBP, now displayed in USD.
export const gbp = usd;
export const rlusd = (n) =>
  Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 }) + " RLUSD";
export const pct = (n) => (Number(n || 0) * 100).toFixed(1) + "%";
