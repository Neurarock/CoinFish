# CoinFish

Time-critical, **off-chain-collateralised** lending on the XRP Ledger.

Businesses that are fiat-rich but crypto-poor can borrow stablecoin **instantly**
on-chain against a fiat deposit held by CoinFish — no on-chain collateral, no slow
bank settlement. Built on XRPL's native Lending Protocol (XLS-66), Single Asset
Vaults (XLS-65), Permissioned Domains (XLS-80) and Credentials (XLS-70).

![alt text](/frontend/src/logo.png)

See **[SPEC.md](./SPEC.md)** for the full design, economics, and demo script.

## Why Devnet + a fake RLUSD
The lending amendment is live on **Devnet only**, while real RLUSD exists on
Testnet/Mainnet only — so they can't coexist. On Devnet, CoinFish mints its own
trustline IOU with the currency code `RLUSD` as a stand-in stablecoin.

## Stack
- **Backend:** FastAPI microservices via **uv** (`backend` product API, `db_service`, domain stubs under `services/`)
- **Frontend:** React (Vite) — stays on npm
- **Off-chain state:** SQLite locally; Postgres via `db_service` + Docker or Neon (`NEON` / ephemeral `NEON_DEV` for migration tests)

## Layout
```
backend/               Product API / BFF (port 8000) — what the UI calls today
db_service/            Persistence microservice (port 8001) + Alembic
services/              Domain FastAPI stubs (auth, pools, lending, borrowing, xrpl, admin)
frontend/              React (npm / Vite)
pyproject.toml         uv workspace root
uv.lock                Locked Python deps
```

## Quick start
```bash
# Python toolchains (one-time)
curl -LsSf https://astral.sh/uv/install.sh | sh
uv sync --all-packages

# 1. Offline checks — NO network needed
uv run pytest backend/tests/ -q
uv run python -m backend.scripts.validate_offline

# 2. Live on Devnet (needs open internet)
uv run python -m backend.scripts.run_demo
uv run python -m backend.scripts.bootstrap_devnet

# run the product API
uv run uvicorn backend.main:app --reload
# or: npm run api
```

For the React/FastAPI local app and Vercel deployment workflow, see
**[docs/LOCAL_AND_VERCEL.md](./docs/LOCAL_AND_VERCEL.md)**. The short version:

```bash
cd frontend && npm install && cd ..
npm run uv:sync
npm run dev:devnet   # frontend :5173 + API :8000 + db API :8001
npm run test:local   # backend tests + frontend build + API smoke test
```

See **[services/README.md](./services/README.md)** for the microservice map and ports.

Each live step prints a `tesSUCCESS` hash + explorer link, and `run_demo` prints
the `vault_id` / `broker_id` / `domain_id` plus the operator account link so you
can open the vault and every transaction on the [Devnet explorer](https://devnet.xrpl.org).

> **Network note:** the lending amendment is Devnet-only, and Devnet is reachable
> over normal internet. The offline checks run anywhere; `run_demo.py`,
> `run_exit_demo.py` and `bootstrap_devnet.py` need internet access.

## Loan terms & lender exits
- **Loans are capped at 72h** (`config.MAX_TERM_HOURS`), single fixed-term. Each
  pool pre-fills a **different default term** (Conservative 24h, Balanced 48h,
  High-Yield 72h) so borrowers have a real reason to shop around — longer
  commitment is cheaper, shorter is more flexible. This still bounds lender
  lock-up: capital lent out always returns within one loan term.
- **Early payoff:** a borrower can repay in full at any time. Interest is charged
  up to the **minimum term** (half the agreed term, `config.MIN_TERM_FRACTION`),
  so lenders keep their committed yield even on an early close.
- **Exit queue** (`exit_queue.py`): a vault `VaultWithdraw` can only draw on
  *idle* liquidity (`AssetsAvailable`); capital out on loan isn't withdrawable
  until repaid. If lenders rush the exit, requests are served first-come-first-
  serve against idle liquidity, **partially filled** where needed, and the rest
  parked in a **fair FIFO queue** that drains as loans repay/mature — so every
  lender exits within at most one loan term. The head of the queue always has
  priority; no one jumps ahead. See `run_exit_demo.py` for the live bank-run.

## Lifecycle coverage (all live on Devnet)
`run_demo.py` walks A→G end to end: bootstrap → lender deposit → borrower
onboarding → instant co-signed loan → full repayment → **default + first-loss
cover draw** (`LoanManage` impair→default, `LoanBroker.CoverAvailable` drawn,
remainder socialised across vault shares) → lender withdrawal.

## Pools (MVP)
| Pool | Risk | First-loss buffer | Base APR | Default term |
|------|------|-------------------|----------|--------------|
| Conservative | low | 20% | 4% | 24h |
| Balanced | medium | 10% | 8% | 48h |
| High-Yield | high | 5% | 14% | 72h |

## Status
Backend chain service layer complete and verified **live on Devnet** (M0–M5):
RLUSD issuance, permissioned-domain + credential onboarding, vault/broker pools
with first-loss capital, co-signed instant loans, full repayment, the
default/first-loss path, and the lender exit queue all run end to end. Offline:
`pytest` + `validate_offline` are green.

The **React dashboard (M6) is built**: three themed worlds — Lender (bright,
purple accent), Borrower (crisp black), and the CoinFish Vault operator console
(pink) — sharing the signature water-tank pool visual, an on-chain processing
overlay for every wallet/loan action, live XRPL Explorer verify links, an
animated Devnet badge, and a multi-quote borrow flow that shops every eligible
pool at once. See `docs/FRONTEND_PLAN.md`.
