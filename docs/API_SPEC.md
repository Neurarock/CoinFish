# CoinFish API Plan and Endpoint Spec

This document describes the FastAPI surface needed by the three frontend
journeys: lender, borrower, and the CoinFish vault dashboard. The implemented
routers live in `backend/routers/` and are mounted by `backend/main.py`.

The API is intentionally demo-first. It separates the UX proof of concept from
real onboarding: KYC, credit checks, wallet connection, bank transfer settlement,
loan disbursement, and transaction hashes are simulated unless
`COINFISH_LIVE_CHAIN=1` is set.

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
  and default actions require XRPL Devnet by default. Set
  `COINFISH_LIVE_CHAIN=1` with valid setup. The developer-only escape hatch is
  `COINFISH_REQUIRE_DEVNET_TRANSACTIONS=0`.
- **Live-chain mode:** with `COINFISH_LIVE_CHAIN=1`, the same endpoint shape calls
  the XRPL service layer for wallet trustlines, vault deposits, loan origination,
  and loan status where implemented.

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

Returns whether the backend is running in local demo mode or XRPL Devnet live
mode, and whether live mode has all required setup ids/seeds.

Local demo response:

```json
{
  "live_chain": false,
  "mode": "local-demo",
  "devnet_ready": false,
  "warnings": []
}
```

Live mode without complete setup returns `live_chain: true`,
`devnet_ready: false`, and concrete warnings such as missing `issuer_address`,
pool `vault_id`, or pool `loan_broker_id`. The frontend header displays this as
`Local demo`, `XRPL Devnet`, or warning state.

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
  "first_loss_buffer": 0.2,
  "tvl": 500000,
  "available": 320000,
  "drawn": 180000,
  "utilisation": 0.36,
  "first_loss_capital": 100000
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
  "tx_hash": "DEMO_HASH",
  "explorer_url": "",
  "receipt_url": "/api/receipts/DEMO_HASH",
  "wallet_balance": 475000,
  "pool": { "key": "med", "tvl": 345000, "drawn": 210000 }
}
```

In local demo mode, `tx_hash` is a synthetic receipt id and `receipt_url` is
populated. In live-chain mode, `explorer_url` is populated with the XRPL Explorer
transaction link and `receipt_url` is empty.

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
  "tx_hashes": ["DEMO_HASH"],
  "explorer_urls": [""],
  "receipt_urls": ["/api/receipts/DEMO_HASH"],
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
  "tx_hash": "DEMO_HASH",
  "explorer_url": "",
  "receipt_url": "/api/receipts/DEMO_HASH",
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

Full repayment is blocked until half the term has elapsed, so the UI can show the
minimum-term warning. Interest-only repayment is available immediately.

Response includes either a live XRPL explorer URL or a local demo receipt URL:

```json
{
  "ok": true,
  "mode": "interest",
  "interest_paid": 9.04,
  "outstanding": 40000,
  "tx_hash": "DEMO_HASH",
  "explorer_url": "",
  "receipt_url": "/api/receipts/DEMO_HASH",
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
  "tx_hash": "DEMO_HASH",
  "explorer_url": "",
  "receipt_url": "/api/receipts/DEMO_HASH"
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
      "origination_explorer_url": "",
      "origination_receipt_url": "/api/receipts/DEMO_HASH",
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
live-chain mode and when the loan has an XRPL id, it also includes `on_chain`
status from the XRPL service layer.

## Demo receipts

### `GET /receipts/{receipt_id}`

Returns an honest receipt for local demo actions. These are not XRPL
transactions.

```json
{
  "receipt_id": "DEMO_HASH",
  "mode": "local-demo",
  "on_chain": false,
  "message": "This is a local CoinFish demo receipt. No XRPL transaction was submitted."
}
```

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
