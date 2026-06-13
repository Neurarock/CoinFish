// Thin fetch wrapper around the CoinFish FastAPI backend.
// In dev, Vite proxies /api -> http://localhost:8000 (see vite.config.js).
const BASE = import.meta.env.VITE_API_BASE || "/api";

let token = null;
export function setToken(t) {
  token = t;
}

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const detail = data?.detail || res.statusText;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data;
}

export const api = {
  // auth + onboarding
  signup: (b) => req("POST", "/auth/signup", b),
  login: (b) => req("POST", "/auth/login", b),
  me: () => req("GET", "/auth/me"),
  verifyKyc: () => req("POST", "/auth/verify/kyc"),
  verifyCredit: () => req("POST", "/auth/verify/credit"),
  connectWallet: (b) => req("POST", "/auth/wallet/connect", b),

  // pools
  pools: () => req("GET", "/pools"),
  runtimeStatus: () => req("GET", "/runtime/status"),
  myTransactions: () => req("GET", "/transactions/me"),
  allTransactions: () => req("GET", "/transactions"),

  // lender
  deposit: (b) => req("POST", "/lenders/deposit", b),
  withdraw: (b) => req("POST", "/lenders/withdraw", b),
  lenderDashboard: () => req("GET", "/lenders/me/dashboard"),

  // borrower
  topupIntent: (b) => req("POST", "/borrowers/collateral/topup", b),
  topupConfirm: (b) => req("POST", "/borrowers/collateral/confirm", b),
  withdrawCollateral: (b) => req("POST", "/borrowers/collateral/withdraw", b),
  quote: (b) => req("POST", "/borrowers/quote", b),
  acceptQuote: (b) => req("POST", "/borrowers/loans/accept", b),
  repay: (loanId, b) => req("POST", `/borrowers/loans/${loanId}/repay`, b),
  defaultLoan: (loanId) => req("POST", `/borrowers/loans/${loanId}/default`),
  borrowerDashboard: () => req("GET", "/borrowers/me/dashboard"),

  // admin / coinfish vault
  adminDashboard: () => req("GET", "/admin/dashboard"),
  extendGrace: (b) => req("POST", "/admin/loans/grace", b),
};
