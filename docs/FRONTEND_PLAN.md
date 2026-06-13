# CoinFish — Frontend Plan (M6)

The frontend is three role-themed worlds over one FastAPI backend: **Lender**
(bright white), **Borrower** (crisp black), and the **CoinFish Vault** (swimming-
pool blue). The product metaphor is *fish in a pool*: liquidity is water, pools
are tanks, utilisation is the water level, and the platform is "buoyant" or
"underwater". The visual language is playful but the copy and risk disclosures
are professional.

Stack: **Vite + React 18 + Tailwind**, React Router, a thin `fetch` API client.
Theming is CSS-variable based so one component set renders correctly in all three
worlds. This document is the design spec; the scaffold that implements it lives in
`frontend/` and the endpoints it consumes are in [`API_SPEC.md`](./API_SPEC.md).

---

## 1. Visual language

| World | Route prefix | Palette | Feel |
|---|---|---|---|
| **Lender** | `/lender/*` | bright white, sky-blue accent | airy, liquid, safe |
| **Borrower** | `/borrower/*` | pure black, cyan accent | fast, sharp, high-contrast |
| **CoinFish Vault** | `/vault` | pool blue, yellow accent | the operator's control room |

Each palette is a set of CSS variables (`--bg`, `--fg`, `--accent`, `--water-top`,
`--water-bot`, `--good/--warn/--bad`, …) declared in `src/index.css` under
`.theme-lender`, `.theme-borrower`, `.theme-vault`. The `Layout` component applies
the right class per role, so the whole tree re-themes instantly; the landing page
re-themes live as you toggle Lender vs Borrower.

**Signature motif — the pool tank (`PoolWater`).** A rounded "tank" whose water
level encodes a pool's utilisation (fraction lent out). Two offset SVG wave strips
slide horizontally for a wobbly surface, a tiled grid gives a pool-floor look, and
a 🐟 bobs at the waterline. Used on every pool card and dashboard. High utilisation
= nearly full tank = little idle liquidity (and slower lender exits).

**Playful flourishes:** swimming-fish loaders, a rising-water "underwater" overlay
on the vault dashboard when the platform is insolvent, ripple effects on action
buttons, and a 🐟 favicon. Kept subtle so the dashboards still read as fintech.

---

## 2. Global structure

```
Landing ("/")  ── login / signup for both roles, simulated KYC + credit, wallet
   │
   ├── Lender world  (theme-lender)
   │      /lender/deposit      choose a pool, deposit
   │      /lender/dashboard    yield, positions, withdraw (exit queue)
   │
   ├── Borrower world (theme-borrower)
   │      /borrower/collateral fiat top-up (bank + QR) / withdraw
   │      /borrower/borrow     eligible pools, 5-second live quote, accept
   │      /borrower/dashboard  borrowed / interest / bill, repay, default
   │
   └── CoinFish vault (theme-vault)
          /vault               fees, solvency, risk, at-risk loans + grace
```

Auth/session lives in `src/store.jsx` (React context, token in `sessionStorage`).
Routes are role-gated by `Guard` in `App.jsx`. The vault dashboard is intentionally
open in the demo (no admin login) so judges can flip to it freely.

---

## 3. Screen-by-screen journey

### 3.1 Landing — login & signup (`pages/Landing.jsx`)
A split screen: a pitch on the left, an auth card on the right, re-themed live by a
Lender/Borrower toggle.

**Signup** collects company details — company name, company number, contact name,
work email, password. *These inputs are for show only; there is no real verification.*
After the account is created the card reveals the onboarding steps:

1. **KYC check button** — orange. Click → "Checking…" → flips **green** (✓ KYC
   verified). Simulates a redirect to an external KYC provider.
2. **Credit check button** — borrowers only (lenders skip it entirely). Same
   orange→green flip; on pass the backend assigns a demo credit score that feeds
   the rate engine.
3. **Connect wallet** — provisions a Devnet wallet for the account (shared by the
   deposit/borrow flows).

When KYC (+ credit for borrowers) is green and a wallet is connected, the **Enter
app** button activates and routes into the right world. **Login** is a simple
email/password form that drops you on your world's first screen.

### 3.2 Lender · Deposit (`pages/LenderDeposit.jsx`)
Headline + a professional **risk notice** (not bank deposits, capital at risk,
variable yield, exit-queue behaviour, first-loss ≠ no-loss, Devnet demo). Then the
**three pools** as cards, each disclosing: net & base APR, first-loss buffer %,
first-loss capital, idle/available liquidity, and a `PoolWater` tank showing how
saturated it is. Selecting a pool opens a deposit panel ("Connect wallet &
deposit"). On success it shows the tx hash and refreshes pool numbers.

### 3.3 Lender · Dashboard (`pages/LenderDashboard.jsx`)
Top stats: total deposited, vault shares, accrued yield (estimate). Then a card per
**position** with its live `PoolWater` saturation, your principal, your yield, and a
**withdraw** input. Withdraw outcomes:

- **Settles immediately** (green) when idle liquidity covers it.
- **Queued / partial** (amber) when the pool is heavily lent out — the message
  explains the remainder is parked in a fair FIFO queue and drains as loans repay,
  within one 24h term. An **Exit queue** table lists each request's filled amount
  and status (pending / partial / filled).

### 3.4 Borrower · Collateral (`pages/BorrowerCollateral.jsx`)
Stats: total collateral, locked-behind-loans, available. **Top up** generates a
simulated **UK bank transfer**: account name, sort code, account number, a unique
reference, plus a self-contained **QR code** (`QrCode.jsx`, derived from the
payload — no external lib). "I've sent the transfer" credits the fiat ledger.
**Withdraw** returns unlocked collateral ("Withdrawal successful"). Collateral
level directly changes which pools the borrower is eligible for.

### 3.5 Borrower · Borrow (`pages/BorrowerBorrow.jsx`)
Cards for each pool tagged **eligible / not eligible** based on available
collateral and current LTV, showing from-APR, max borrow, current LTV, pool
liquidity. Pick an eligible pool, enter amount + term (≤24h), **Request quote**.
The quote is **live for 5 seconds**: a circular countdown ring runs down; **Accept**
within the window disburses RLUSD to the connected wallet (shows the tx hash, then
routes to the dashboard). After 0s the button flips to "Expired — re-quote".

### 3.6 Borrower · Dashboard (`pages/BorrowerDashboard.jsx`)
Stats: total borrowed, outstanding, interest paid, available collateral. An itemised
**bill** (interest paid, origination fees, default charges, owed now). Per active
loan: **Repay interest** (interest-only), **Repay in full** (blocked with a clear
min-term warning if the loan hasn't been held long enough), and **Default** (forfeit
collateral + a clearly-shown default charge, then the loan is marked defaulted and
the charge appears in the bill).

### 3.7 CoinFish · Vault dashboard (`pages/VaultDashboard.jsx`)
The operator control room, pool-blue. Stats: **fees collected**, total TVL, out on
loan, first-loss capital. A solvency pill (**buoyant** vs **⚠ underwater**, with the
solvency ratio); when underwater a full-bleed rising-water overlay with swimming
fish washes over the page. A **risk-score** half-gauge (0–100, low/elevated/critical)
computed from utilisation + first-loss coverage. Per-pool `PoolWater` saturation.
Finally the **critical section**: loans inside the grace window about to default,
each showing time-to-default (or hours overdue) and a control to **extend grace by N
hours**. The page polls every 5s so it feels live.

---

## 4. Component inventory

| Component | Role |
|---|---|
| `components/Layout.jsx` | Applies the role theme + renders nav; wraps every authed page. |
| `components/PoolWater.jsx` | The animated water-level tank (utilisation gauge). |
| `components/CheckButton.jsx` | Orange→green KYC / credit-check button. |
| `components/QrCode.jsx` | Self-contained deterministic QR for the fiat top-up. |
| `components/ui.jsx` | Atoms: `Button`, `Field`, `Stat`, `Pill`, money/percent format helpers. |
| `store.jsx` | Auth/session context (account, token, login/logout). |
| `api.js` | Typed-ish fetch client for every backend endpoint. |

---

## 5. State & data flow

- **Auth:** `store.jsx` holds `{account, token}`; `api.js` attaches the bearer
  token. Token + account cached in `sessionStorage` so a refresh keeps you in.
- **Reads:** each dashboard calls its `*/me/dashboard` (or `/pools`, `/admin/
  dashboard`) on mount; the vault polls every 5s.
- **Writes:** deposit / withdraw / quote / accept / repay / default / grace all
  POST, then re-fetch the relevant dashboard to reflect new numbers.
- **Quotes:** the 5-second TTL is enforced server-side (`runtime.QUOTE_TTL`); the
  client mirrors it with a countdown and disables Accept on expiry.

---

## 6. Animations (Tailwind keyframes in `tailwind.config.js`)

`wave` / `wave-slow` (sliding wave strips), `bob` (fish at the surface / rising
water), `swim` (fish crossing the underwater overlay), `ripple` (button feedback).
All are GPU-friendly transforms; the water level itself is a CSS `top` transition so
it eases smoothly when utilisation changes.

---

## 7. Running it

```bash
# backend (from repo root)
uvicorn backend.main:app --reload          # http://localhost:8000

# frontend
cd frontend && npm install && npm run dev   # http://localhost:5173
```

The Vite dev server proxies `/api` → `:8000` (see `vite.config.js`). The backend
runs in off-chain demo mode by default so the whole journey is clickable with no
network; set `COINFISH_LIVE_CHAIN=1` to route deposits/loans/repays through Devnet.

---

## 8. Future polish (not in the scaffold)

Live tx-hash → explorer links on every action card; a websocket feed so lender and
vault dashboards update without polling; a borrower "rollover at maturity" flow;
per-pool historical APR sparklines; and the ZK-solvency badge from SPEC §12 surfaced
on the lender deposit screen.
