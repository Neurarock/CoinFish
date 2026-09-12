import { VerifyLink, rlusd } from "./ui.jsx";

export default function TxLedger({ rows = [], title = "XRPL transaction ledger" }) {
  if (!rows.length) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xl font-bold">{title}</h2>
      <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
        {rows.slice(0, 8).map((tx) => (
          <div key={tx.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
            <div>
              <div className="font-bold">{label(tx.action)}</div>
              <div className="text-xs" style={{ color: "var(--fg-soft)" }}>
                {tx.pool_key && <>pool {tx.pool_key} · </>}
                {tx.amount > 0 && <>{rlusd(tx.amount)} · </>}
                {new Date(tx.created_at).toLocaleString()}
              </div>
            </div>
            <VerifyLink href={tx.explorer_url} hash={tx.tx_hash} label="Verify on XRPL" />
          </div>
        ))}
      </div>
    </section>
  );
}

function label(action) {
  return String(action || "")
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}
