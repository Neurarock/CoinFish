// A global, beautiful "this is happening on-chain" overlay. On-chain actions
// (connect wallet, deposit, borrow, repay, withdraw, default…) take a few
// seconds to confirm; instead of a dead UI, we show an animated multi-step
// progress card so the wait feels intentional and premium.
//
// Usage:  const { track } = useTx();
//         const res = await track(api.deposit(body), { title, steps, success });
// `track` resolves with the API result (and shows a success state + explorer
// link), or rejects (and shows the error) — callers handle the value as normal.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const TxCtx = createContext(null);
export const useTx = () => useContext(TxCtx);

const DEFAULT_STEPS = ["Preparing transaction", "Signing", "Submitting to XRPL", "Awaiting validation"];

export function TxProvider({ children }) {
  const [st, setSt] = useState(null); // null = closed
  const timers = useRef([]);

  const clearTimers = () => {
    timers.current.forEach((t) => clearInterval(t) || clearTimeout(t));
    timers.current = [];
  };
  const close = useCallback(() => { clearTimers(); setSt(null); }, []);

  const track = useCallback(async (promise, opts = {}) => {
    const steps = opts.steps?.length ? opts.steps : DEFAULT_STEPS;
    const stepMs = opts.stepMs || 780;
    // Inherit whatever role theme is currently mounted so the overlay's accent
    // colours match the page the user is on (purple / cyan / pink).
    const themed = typeof document !== "undefined"
      ? document.querySelector(".theme-lender, .theme-borrower, .theme-vault") : null;
    const theme = themed ? [...themed.classList].find((c) => c.startsWith("theme-")) || "" : "";
    clearTimers();
    setSt({ title: opts.title || "Submitting to XRPL", steps, idx: 0, status: "running",
            theme, message: "", explorerUrl: "", successLabel: opts.success || "Confirmed on XRPL Devnet" });

    // Walk the steps, pausing on the final one until the promise settles.
    const iv = setInterval(() => {
      setSt((s) => (s && s.status === "running" && s.idx < s.steps.length - 1
        ? { ...s, idx: s.idx + 1 } : s));
    }, stepMs);
    timers.current.push(iv);

    try {
      const res = await promise;
      clearTimers();
      const explorerUrl = res?.explorer_url || res?.explorerUrl ||
        (Array.isArray(res?.explorer_urls) ? res.explorer_urls[0] : "") || "";
      setSt((s) => s && ({ ...s, idx: s.steps.length, status: "success", explorerUrl }));
      const t = setTimeout(() => setSt(null), opts.holdMs ?? 1400);
      timers.current.push(t);
      return res;
    } catch (e) {
      clearTimers();
      setSt((s) => s && ({ ...s, status: "error", message: e?.message || "Transaction failed" }));
      throw e;
    }
  }, []);

  useEffect(() => clearTimers, []);

  return (
    <TxCtx.Provider value={{ track, close }}>
      {children}
      {st && <Overlay st={st} onClose={close} />}
    </TxCtx.Provider>
  );
}

function Overlay({ st, onClose }) {
  const { title, steps, idx, status, message, explorerUrl, successLabel, theme } = st;
  return (
    <div className={`tx-scrim ${theme || ""}`} onClick={status !== "running" ? onClose : undefined}>
      <div className="tx-card morph-edge" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-4">
          {status === "running" && <div className="tx-ring" />}
          {status === "success" && <ResultMark tone="good">✓</ResultMark>}
          {status === "error" && <ResultMark tone="bad">!</ResultMark>}
          <div>
            <div className="text-lg font-extrabold morph-text">
              {status === "error" ? "Couldn’t complete" : status === "success" ? successLabel : title}
            </div>
            <div className="text-xs" style={{ color: "var(--fg-soft)" }}>
              {status === "error"
                ? "No funds moved — you can safely retry."
                : "Running on the XRP Ledger · Devnet"}
            </div>
          </div>
        </div>

        {status !== "error" && (
          <div className="mt-4 space-y-0.5">
            {steps.map((label, i) => {
              const done = i < idx || status === "success";
              const active = i === idx && status === "running";
              return (
                <div className="tx-step" key={label} style={{ animationDelay: `${i * 60}ms` }}>
                  <span className={`tx-dot ${done ? "done" : active ? "active" : ""}`}>
                    {done ? "✓" : ""}
                  </span>
                  <span style={{ color: done || active ? "var(--fg)" : "var(--fg-soft)", fontWeight: active ? 700 : 500 }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {status === "error" && (
          <div className="mt-3 text-sm" style={{ color: "var(--bad)" }}>{message}</div>
        )}

        {(status === "success" && explorerUrl) && (
          <a className="verify-link mt-4" href={explorerUrl} target="_blank" rel="noreferrer">
            <span className="verify-dot" /> <span>Verify on XRPL</span>
          </a>
        )}

        {status !== "running" && (
          <button onClick={onClose}
            className="btn btn-ghost mt-4 w-full justify-center">
            {status === "error" ? "Close" : "Done"}
          </button>
        )}
      </div>
    </div>
  );
}

function ResultMark({ tone, children }) {
  return (
    <div style={{
      width: 84, height: 84, borderRadius: 999, flex: "none",
      display: "grid", placeItems: "center", fontSize: 34, fontWeight: 900, color: "#fff",
      background: `var(--${tone})`,
      boxShadow: `0 0 0 8px color-mix(in srgb, var(--${tone}) 18%, transparent)`,
    }}>
      {children}
    </div>
  );
}
