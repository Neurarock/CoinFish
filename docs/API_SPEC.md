# CoinFish API Plan and Endpoint Spec

This document describes the FastAPI surface needed by the three frontend
journeys: lender, borrower, and the CoinFish vault dashboard. The implemented
routers live in `backend/routers/` and are mounted by `backend/main.py`.

The API is intentionally proof-of-concept friendly, but XRPL proof is real:
KYC, credit checks, and fiat bank-transfer settlement are simulated business
events; wallet, vault, loan, repayment, withdrawal, and default actions submit
real XRPL Devnet transactions and persist real explorer links.

## Cross-cutting behaviour

- **Base URL:** `/`
- **Frontend dev proxy:** Vite proxies `/api` to `http://localhost:8000`.
- **Auth:** login/signup returns an opaque bearer token. Send it as
  `Authorization: Bearer <token>`. Demo tokens are persisted in SQLite so browser
  refreshes and backend reloads do not immediately orphan the session.
- **Roles:** `lender` and `borrower` routes are role-gated. The vault dashboard is
  open for the demo so evaluators can inspect it without creating an admin user.
- **Persistence:** SQLModel/SQLite stores accounts, fiat-collateral ledger rows,
  deposits, loans, and lender exit rows. Runtime pool balances, quote cache, and
  fee totals are held in memory for the demo.
- **Quote TTL:** borrower quotes are live for 5 seconds server-side.
- **Devnet requirement:** wallet, deposit, withdraw, loan origination, repayment,
  and default actions require a bootstrapped XRPL Devnet setup. There is no
  local synthetic transaction mode.
- **Verify links:** account, transaction, vault object, loan broker object, and
  loan object fields use `https://devnet.xrpl.org/...` links so users can verify
  on Explorer.

## Root and pools

### `GET /`

Health and network summary.

Response:

```json
{
  "service": "CoinFish",
  "network": "XRPL Devnet",
  "stablecoin": "RLUSD",
  "pools": ["low", "med", "high"]
}
```

### `GET /runtime/status`

Returns whether the backend has all required Devnet setup ids/seeds.

Ready response:

```json
{
  "live_chain": true,
  "mode": "xrpl-devnet-live",
  "devnet_ready": true,
  "warnings": []
}
```

If setup is incomplete, `devnet_ready` is false and `warnings` names the missing
issuer, operator, vault, or loan broker value. The frontend header displays this
as `Devnet setup`.

### `GET /transactions`

Returns persisted XRPL transaction records submitted by frontend-driven API flows.
Each record includes `action`, `tx_hash`, `explorer_url`, `engine_result`,
optional `pool_key`, optional `loan_id`, and `amount`.

### `GET /transactions/me`

Authenticated view of the current account's XRPL transaction records. Lender and
borrower dashboards render this as the transaction ledger.

### `GET /pools`

Returns the three lend/borrow pools used by lender deposit cards, borrower
eligibility cards, and the vault dashboard.

Response fields per pool:

```json
{
  "key": "low",
  "name": "Prime Pool",
  "risk_tier": "low",
  "base_apr": 0.08,
  "net_apr": 0.0776,
  "default_term_hours": 24,
  "first_loss_buffer": 0.2,
  "tvl": 500000,
  "available": 320000,
  "drawn": 180000,
  "utilisation": 0.36,
  "first_loss_capital": 100000,
  "vault_id": "ABC...",
  "loan_broker_id": "DEF...",
  "vault_explorer_url": "https://devnet.xrpl.org/objects/ABC...",
  "loan_broker_explorer_url": "https://devnet.xrpl.org/objects/DEF..."
}
```

### `GET /pools/{key}`

Returns one pool. Used when a page needs to refresh a single card.

## Auth and onboarding

### `POST /auth/signup`

Creates a lender or borrower company account and returns a demo session token.
Inputs such as contact name and company number are captured to make the UX feel
complete; they are not verified.

Request:

```json
{
  "role": "borrower",
  "company_name": "Example Trading Ltd",
  "email": "ops@example.test",
  "password": "demo-pass",
  "contact_name": "Ava Shah",
  "company_number": "12345678"
}
```

Response:

```json
{
  "token": "opaque-demo-token",
  "account": {
    "id": 1,
    "role": "borrower",
    "company_name": "Example Trading Ltd",
    "email": "ops@example.test",
    "kyc_status": "pending",
    "credit_status": "pending",
    "credit_score": 0,
    "xrpl_address": "",
    "wallet_provider": "",
    "wallet_rlusd_balance": 0,
    "wallet_explorer_url": "",
    "wallet_connected": false
  }
}
```

Lender accounts get `credit_status: "n/a"` because they do not need a credit
check in this proof of concept.

### `POST /auth/login`

Returns a token for an existing demo account.

Request:

```json
{ "email": "ops@example.test", "password": "demo-pass" }
```

### `GET /auth/me`

Returns the current account. Used to restore session state after refresh.

### `POST /auth/verify/kyc`

Simulates a redirect to an external KYC provider and flips KYC from orange
`pending` to green `passed`.

Response: `AccountOut`

### `POST /auth/verify/credit`

Borrower only. Simulates an external credit check, flips credit status to
`passed`, and assigns a demo score used by the risk engine. Lenders receive
`400` because credit is not required for them.

Response: `AccountOut`

### `POST /auth/wallet/connect`

Connects an XRPL signer. In the demo, the frontend lets the user choose Xaman,
Crossmark, GemWallet, or a Devnet signer and optionally provide an address. The
backend records provider, a syntactically valid XRPL classic address, and
persisted demo RLUSD balance. In live-chain mode it creates a faucet wallet and
trustline, and returns an XRPL Explorer account link.

Request:

```json
{ "provider": "crossmark", "address": "r..." }
```

`address` is optional in demo mode.

Response:

```json
{
  "xrpl_address": "r...",
  "provider": "crossmark",
  "rlusd_balance": 500000,
  "explorer_url": ""
}
```

`explorer_url` is empty in local demo mode. It is populated only when the account
really exists on XRPL Devnet.

## Lender endpoints

### `POST /lenders/deposit`

Deposits RLUSD into one pool vault and records the lender's position.

Request:

```json
{ "pool_key": "med", "amount": 25000 }
```

Response:

```json
{
  "ok": true,
  "tx_hash": "A753...",
  "explorer_url": "https://devnet.xrpl.org/transactions/A753...",
  "wallet_balance": 475000,
  "pool": { "key": "med", "tvl": 345000, "drawn": 210000 }
}
```

Errors:

- `400` if the lender has not connected a wallet.
- `400` if amount is not positive.
- `404` for an unknown pool.

### `POST /lenders/withdraw`

Requests a withdrawal from a lender position. If pool idle liquidity is
sufficient, the withdrawal fills immediately; otherwise the remaining amount is
queued.

Request:

```json
{ "pool_key": "high", "amount": 5000 }
```

Response:

```json
{
  "ok": true,
  "status": "partial",
  "filled": 1200,
  "remaining": 3800,
  "queued": true,
  "message": "Pool liquidity is low...",
  "tx_hashes": ["B882..."],
  "explorer_urls": ["https://devnet.xrpl.org/transactions/B882..."],
  "wallet_balance": 480000
}
```

### `GET /lenders/me/dashboard`

Returns lender holdings, estimated yield, and exit queue rows. Filled withdrawal
amounts are subtracted from `total_deposited`, `total_shares`, and each
position's `your_principal`.

Response:

```json
{
  "account": { "id": 2, "role": "lender" },
  "total_deposited": 25000,
  "total_shares": 25000,
  "accrued_yield": 5.31,
  "positions": [
    {
      "key": "med",
      "name": "Growth Pool",
      "utilisation": 0.61,
      "your_principal": 25000,
      "your_yield": 5.31
    }
  ],
  "exit_queue": [
    {
      "pool_key": "med",
      "amount_requested": 5000,
      "amount_filled": 5000,
      "status": "filled"
    }
  ]
}
```

## Borrower endpoints

### `POST /borrowers/collateral/topup`

Creates simulated UK bank-transfer details and a QR payload for the top-up screen.
This does not credit collateral yet.

Request:

```json
{ "amount": 100000 }
```

Response:

```json
{
  "amount": 100000,
  "account_name": "CoinFish Custody Ltd",
  "sort_code": "04-00-72",
  "account_number": "12345678",
  "reference": "CF-0001-12345",
  "qr_payload": "bank://transfer?..."
}
```

### `POST /borrowers/collateral/confirm`

Simulates the bank transfer arriving and credits the fiat collateral ledger.

Request:

```json
{ "amount": 100000 }
```

Response:

```json
{ "ok": true, "collateral": 100000, "reference": "CF-0001-12346" }
```

### `POST /borrowers/collateral/withdraw`

Withdraws unlocked collateral. Locked collateral behind live loans cannot be
withdrawn.

Request:

```json
{ "amount": 10000 }
```

Response:

```json
{ "ok": true, "collateral": 90000, "message": "Withdrawal successful." }
```

### `POST /borrowers/quote`

Returns a live 5-second quote for an eligible pool, amount, and duration.

Request:

```json
{ "pool_key": "low", "amount": 40000, "term_hours": 24 }
```

Response:

```json
{
  "id": "5ec9d941df6a",
  "pool_key": "low",
  "principal": 40000,
  "interest_rate": 0.0825,
  "term_hours": 24,
  "origination_fee": 50,
  "approved": true,
  "reason": "approved",
  "seconds_left": 5,
  "expires_at": 1781386000.123
}
```

If not approved, the response still returns a quote-shaped object with
`approved: false` and a human-readable `reason`.

> Note: each pool also carries a `default_term_hours` (Conservative 24h, Balanced
> 48h, High-Yield 72h) that the UI pre-fills, and `term_hours` is capped at 72h.

### `POST /borrowers/quotes`

Quotes **every pool at once** for a single amount, so the borrower can shop
around. Each pool uses its own `default_term_hours`. Eligible pools include a
live quote; ineligible pools include a `reason` and `quote: null`.

Request:

```json
{ "amount": 40000 }
```

Response:

```json
{
  "amount": 40000,
  "quotes": [
    {
      "pool_key": "low", "name": "CoinFish Conservative", "risk_tier": "low",
      "base_apr": 0.04, "default_term_hours": 24, "available_liquidity": 320000,
      "max_borrow": 64000, "eligible": true, "reason": "",
      "quote": {
        "id": "5ec9d941df6a", "principal": 40000, "interest_rate": 0.061,
        "term_hours": 24, "origination_fee": 201, "total_interest": 6.68,
        "seconds_left": 5, "expires_at": 1781386000.123
      }
    },
    {
      "pool_key": "high", "name": "CoinFish High-Yield", "risk_tier": "high",
      "base_apr": 0.14, "default_term_hours": 72, "available_liquidity": 21000,
      "max_borrow": 0, "eligible": false,
      "reason": "No borrowing headroom left — repay or add collateral.",
      "quote": null
    }
  ]
}
```

### `POST /borrowers/wallet/receive`

Returns the connected wallet's address plus a `xrpl://` QR payload so the borrower
can **receive RLUSD** (to fund repayments) — the on-chain mirror of the fiat
top-up QR.

Request:

```json
{ "amount": 100 }
```

Response:

```json
{
  "xrpl_address": "r...",
  "currency": "RLUSD",
  "issuer_address": "r...",
  "amount": 100,
  "qr_payload": "xrpl://r...?currency=RLUSD&issuer=r...&amount=100.00",
  "explorer_url": "https://devnet.xrpl.org/accounts/r...",
  "rlusd_balance": 250.0
}
```

### `POST /borrowers/loans/accept`

Accepts a live quote, locks collateral, books the loan, and disburses to the
connected wallet.

Request:

```json
{ "quote_id": "5ec9d941df6a" }
```

Response:

```json
{
  "ok": true,
  "loan_id": 1,
  "tx_hash": "C991...",
  "explorer_url": "https://devnet.xrpl.org/transactions/C991...",
  "xrpl_loan_id": "D044...",
  "loan_explorer_url": "https://devnet.xrpl.org/objects/D044...",
  "wallet_balance": 40000,
  "disbursed_to": "r...",
  "principal": 40000
}
```

Errors:

- `410` if the quote has expired.
- `400` if the quote was not approved.
- `400` if no wallet is connected.

### `POST /borrowers/loans/{loan_id}/repay`

Repays either interest-only or principal plus interest.

Request:

```json
{ "mode": "interest" }
```

or:

```json
{ "mode": "full" }
```

Full repayment ("repay all early") is allowed at **any** time. Interest is charged
up to the **minimum term** (half the agreed term, `config.MIN_TERM_FRACTION`), so
lenders keep their committed yield even on an early close. The `full` response
adds `payoff_total`, `interest_charged`, `early`, and `min_term_hours`. The
borrower dashboard exposes the live payoff for each active loan under
`loans[].payoff`. Interest-only repayment is available immediately.

Response includes the XRPL Devnet transaction link:

```json
{
  "ok": true,
  "mode": "interest",
  "interest_paid": 9.04,
  "outstanding": 40000,
  "tx_hash": "E722...",
  "explorer_url": "https://devnet.xrpl.org/transactions/E722...",
  "wallet_balance": 39990.96
}
```

### `POST /borrowers/loans/{loan_id}/default`

Lets the borrower explicitly default at any time. The demo seizes the principal
plus a default charge from fiat collateral and marks the loan defaulted.

Response:

```json
{
  "ok": true,
  "status": "defaulted",
  "default_charge": 2050,
  "collateral_seized": 42050,
  "tx_hash": "F130...",
  "explorer_url": "https://devnet.xrpl.org/transactions/F130..."
}
```

### `GET /borrowers/me/dashboard`

Returns collateral, eligibility, loan list, and an itemised bill.

Response:

```json
{
  "collateral": 100000,
  "collateral_locked": 40000,
  "collateral_available": 60000,
  "total_borrowed": 40000,
  "interest_paid": 0,
  "outstanding": 40000,
  "eligible_pools": [
    {
      "key": "low",
      "max_borrow": 48000,
      "current_ltv": 0.6667,
      "eligible": true
    }
  ],
  "loans": [
    {
      "id": 1,
      "pool_key": "low",
      "principal": 40000,
      "status": "active",
      "xrpl_loan_id": "D044...",
      "loan_explorer_url": "https://devnet.xrpl.org/objects/D044...",
      "origination_explorer_url": "https://devnet.xrpl.org/transactions/C991...",
      "due_at": "2026-06-14T12:00:00"
    }
  ],
  "bill": {
    "interest_paid": 0,
    "origination_fees": 50,
    "default_charges": 0,
    "total_owed_now": 40000
  }
}
```

## CoinFish vault endpoints

### `GET /admin/dashboard`

Returns the operator view: fees, TVL, utilisation, first-loss capital, solvency,
risk score, and grace-window loans.

Response:

```json
{
  "fees_collected": 50,
  "total_tvl": 960000,
  "total_drawn": 509000,
  "total_first_loss": 139000,
  "underwater": false,
  "solvency_ratio": 1.18,
  "risk_score": 44.2,
  "risk_band": "elevated",
  "pools": [{ "key": "low", "utilisation": 0.36 }],
  "at_risk_loans": [
    {
      "loan_id": 1,
      "account_id": 3,
      "pool_key": "low",
      "principal": 40000,
      "hours_to_default": 2.5,
      "grace_extra_hours": 0,
      "in_grace": false
    }
  ]
}
```

### `POST /admin/loans/grace`

Extends a loan grace period from the vault dashboard critical section.

Request:

```json
{ "loan_id": 1, "hours": 4 }
```

Response:

```json
{ "ok": true, "loan_id": 1, "grace_extra_hours": 4 }
```

## Shared loan lookup

### `GET /loans/{loan_id}`

Returns read-only loan status for borrower or operator support flows. In
when the loan has an XRPL id, it also includes `on_chain` status from the XRPL
service layer.

## Backend additions still worth considering

- Persist runtime pool balances and fee totals so a backend restart does not reset
  demo liquidity.
- Replace demo bearer tokens with signed tokens or a production-grade session
  table.
- Add a websocket/SSE feed for pool and vault metrics instead of polling.
- Model borrower maturity/default timers as scheduled jobs instead of dashboard
  reads.
- Gate `/admin/*` behind an admin role when moving beyond the proof of concept.
- Add audit/event rows for every simulated external action so the demo has a full
  activity timeline.
