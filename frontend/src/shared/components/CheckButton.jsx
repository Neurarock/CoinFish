// The KYC / credit-check button from signup. Simulates a round-trip to an
// external provider: click -> "checking…" -> flips orange to green. Cosmetic
// only — there is no real verification (by design, for the demo).
import { useState } from "react";

export default function CheckButton({ label, done, onPass }) {
  const [busy, setBusy] = useState(false);
  const passed = !!done;

  async function run() {
    if (passed || busy) return;
    setBusy(true);
    // brief delay to feel like an external redirect/check
    await new Promise((r) => setTimeout(r, 900));
    try {
      await onPass?.();
    } finally {
      setBusy(false);
    }
  }

  const bg = passed ? "var(--good)" : busy ? "#d97706" : "#f97316";
  return (
    <button
      type="button"
      onClick={run}
      className="btn w-full"
      style={{ background: bg, color: "#fff", justifyContent: "center" }}
    >
      {passed ? `✓ ${label} verified` : busy ? `Checking ${label}…` : `Run ${label} check`}
    </button>
  );
}
