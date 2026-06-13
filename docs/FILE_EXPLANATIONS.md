# CoinFish File Explanations

This guide explains the important files introduced for the frontend UX/API proof
of concept, plus grouped notes for the smaller related files. It is written for a
developer picking up the repo after the Devnet plumbing work.

## Important backend files

### `backend/main.py`

The FastAPI app entrypoint. It creates the app, enables permissive CORS for the
local Vite frontend, initialises the SQLite database on startup, exposes the root
health summary, and mounts all role routers:

- `auth`
- `pools`
- `lenders`
- `borrowers`
- `loans`
- `admin`

Run it from the repo root with:

```bash
uvicorn backend.main:app --reload
```

### `backend/db.py`

Defines the off-chain SQLModel tables used by the UX demo:

- `Account` stores role, company details, simulated KYC/credit state, and demo
  wallet mapping.
- `FiatLedger` stores borrower fiat collateral movements.
- `Deposit` stores lender positions.
- `Loan` stores accepted borrower loans and policy metadata.
- `ExitRow` stores lender withdrawal queue rows.

The database defaults to `sqlite:///./coinfish.db`. Override with
`COINFISH_DB_URL` for tests or alternate local runs.

### `backend/schemas.py`

The Pydantic request and response models for the API. These are the contract the
React client consumes, so add or rename frontend-visible fields here first. The
main groups are auth, wallet, lender, borrower, and admin dashboard models.

### `backend/runtime.py`

The runtime bridge between the API and XRPL service layer. It holds the three pool
states, quote cache, exit queues, Devnet setup ids, and fee totals. It also
provides `LIVE_CHAIN`, controlled by `COINFISH_LIVE_CHAIN=1`.

In demo mode, pool TVL/drawn/first-loss values are seeded so the dashboards look
alive immediately. In live-chain mode, selected actions call `backend/xrpl_service`.

### `backend/services.py`

Shared backend helpers:

- lightweight demo password hashing and token issuing;
- FastAPI dependencies for current account, session, and role gating;
- account serialization;
- collateral balance math.

The collateral helpers deliberately treat `lock` and `release` rows as
informational ring-fencing, not custody movements. This avoids double-counting
borrower collateral when a loan is accepted.

### `backend/routers/auth.py`

Implements the onboarding journey:

- signup/login;
- orange-to-green simulated KYC and credit checks;
- wallet connection;
- current account lookup.

There is no real email verification, KYC provider, credit bureau, or wallet
browser integration. The endpoints are there to make the product journey visible
and clickable.

### `backend/routers/lenders.py`

Implements lender deposit, dashboard, and withdrawal. Withdrawals use the existing
`ExitQueue` service so a lender either exits immediately or receives a queued /
partial status when the pool lacks idle liquidity.

### `backend/routers/borrowers.py`

Implements borrower collateral, eligibility, live quote, accept quote, repay, and
default flows. The key concepts are:

- fiat collateral is topped up through simulated bank-transfer instructions;
- eligibility comes from available collateral and current LTV;
- quotes expire after 5 seconds;
- accepting a quote locks collateral and increases pool draw;
- full repayment is blocked until half the term has elapsed;
- default seizes principal plus a displayed default charge.

### `backend/routers/admin.py`

Implements the CoinFish vault dashboard. It aggregates fees, TVL, drawn liquidity,
first-loss capital, solvency state, a composite risk score, and loans near or past
their grace deadline. It also exposes the grace-extension action.

Admin auth is intentionally relaxed for the demo so the dashboard can be opened
without a separate login. Gate this router with `admin_only` before production.

## Important frontend files

### `frontend/src/App.jsx`

Defines the route map and role guards:

- `/` landing/login/signup;
- `/lender/deposit`;
- `/lender/dashboard`;
- `/borrower/collateral`;
- `/borrower/borrow`;
- `/borrower/dashboard`;
- `/vault`.

The vault route is open in demo mode.

### `frontend/src/api.js`

The thin fetch client for the FastAPI backend. It attaches the bearer token,
normalises JSON/error handling, and exposes one method per backend action. The
frontend calls this file rather than embedding endpoint strings inside pages.

### `frontend/src/store.jsx`

The auth/session context. It stores the current account and bearer token in
`sessionStorage`, restores them on refresh, and exposes login/signup/logout helpers
to the pages.

### `frontend/src/index.css`

Global styling and visual language. It imports Tailwind and defines the theme CSS
variables for:

- lender bright white;
- borrower pure black;
- CoinFish pool blue.

The role theme classes let the same components feel like distinct product worlds.

### `frontend/src/components/Layout.jsx`

The authenticated page shell. It applies the current theme class, renders the
navigation, and keeps the lender, borrower, and vault views consistent.

### `frontend/src/components/PoolWater.jsx`

The signature utilisation visual: an animated water-level tank. Pool utilisation
controls the water height; waves and small fish cues make the pool metaphor
legible without replacing the financial metrics.

### `frontend/src/pages/Landing.jsx`

The login/signup and onboarding screen. Signup collects company information, then
shows simulated KYC, simulated credit for borrowers, and wallet connection. Once
the relevant buttons are green and a wallet exists, the user can enter the role
journey.

### `frontend/src/pages/LenderDeposit.jsx`

The lender's first post-login screen. It shows professional risk warnings, the
three pool cards, wallet status, and a deposit form. Successful deposits refresh
pool data and show the returned transaction hash.

### `frontend/src/pages/LenderDashboard.jsx`

Shows the lender's total deposited amount, estimated yield, pool positions,
utilisation tanks, and withdrawal flow. Queued withdrawals are shown in the exit
queue table.

### `frontend/src/pages/BorrowerCollateral.jsx`

Shows borrower collateral, locked collateral, and available collateral. It
generates UK bank-transfer details and a QR payload for top-ups, then simulates the
transfer arriving when the user confirms. It also supports unlocked collateral
withdrawals.

### `frontend/src/pages/BorrowerBorrow.jsx`

Shows pool eligibility and quote flow. The borrower chooses an eligible pool,
amount, and term, requests a quote, then has 5 seconds to accept it before it
expires.

### `frontend/src/pages/BorrowerDashboard.jsx`

Shows borrower loan totals, interest paid, outstanding balance, itemised bill, and
per-loan actions for interest-only repay, full repay, and default.

### `frontend/src/pages/VaultDashboard.jsx`

The CoinFish operator view. It shows fees collected, solvency state, risk score,
pool utilisation, underwater visual state, and the critical at-risk loan section
with grace-extension controls.

## Smaller related files

### Backend router package files

`backend/routers/__init__.py` marks the router directory as a package.
`backend/routers/pools.py` provides shared pool read endpoints.
`backend/routers/loans.py` provides a read-only loan status lookup used by support
or future detail pages.

### Existing backend engines used by the UX layer

`backend/config.py` defines the three pool configs, fees, and Devnet settings.
`backend/risk_engine.py` produces borrower quote pricing and approval decisions.
`backend/exit_queue.py` implements lender withdrawal queue mechanics.
`backend/xrpl_service/*` contains the lower-level Devnet operations reused when
`COINFISH_LIVE_CHAIN=1`.

### Frontend component helpers

`frontend/src/components/CheckButton.jsx` is the orange-to-green KYC/credit button.
`frontend/src/components/QrCode.jsx` renders a deterministic QR-like code for the
bank transfer payload without adding a dependency.
`frontend/src/components/ui.jsx` contains small shared UI atoms and formatting
helpers.

### Frontend project configuration

`frontend/package.json` declares Vite, React, Tailwind, and scripts.
`frontend/vite.config.js` configures React and the `/api` dev proxy.
`frontend/tailwind.config.js` declares the custom animations.
`frontend/postcss.config.js`, `frontend/index.html`, and `frontend/src/main.jsx`
are standard Vite/Tailwind entry files.

### Documentation

`docs/FRONTEND_PLAN.md` is the product/UX journey plan.
`docs/API_SPEC.md` is the backend endpoint plan and contract.
`docs/FILE_EXPLANATIONS.md` is this implementation map.
