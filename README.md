# CoinFish 🐟

Time-critical, **off-chain-collateralised** lending on the XRP Ledger.

Businesses that are fiat-rich but crypto-poor can borrow stablecoin **instantly**
on-chain against a fiat deposit held by CoinFish — no on-chain collateral, no slow
bank settlement. Built on XRPL's native Lending Protocol (XLS-66), Single Asset
Vaults (XLS-65), Permissioned Domains (XLS-80) and Credentials (XLS-70).

See **[SPEC.md](./SPEC.md)** for the full design, economics, and demo script.

## Why Devnet + a fake RLUSD
The lending amendment is live on **Devnet only**, while real RLUSD exists on
Testnet/Mainnet only — so they can't coexist. On Devnet, CoinFish mints its own
trustline IOU with the currency code `RLUSD` as a stand-in stablecoin.

## Stack
- **Backend:** FastAPI + `xrpl-py` 5.0.0 (all on-chain logic is Python)
- **Frontend:** React (Vite + Tailwind) — the demo dashboard
- **Off-chain state:** SQLite (KYC, fiat deposits, credit policy)

## Layout
```
backend/
  config.py            network, seeds, fee + pool params
  main.py              FastAPI app
  risk_engine.py       interest-rate / credit logic (off-chain)
  xrpl_service/        client, assets(RLUSD), identity, vault, broker, loan
  scripts/
    bootstrap_devnet.py  one-shot: wallets, RLUSD, domain, 3 pools
frontend/              React dashboard (WIP)
reference/             starter scripts kept for porting (JS credentials/domains, python)
SPEC.md                full spec
```

## Quick start
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt

# 1. Verify every transaction builds, validates & signs — NO network needed
python -m backend.scripts.validate_offline

# 2. Full live lifecycle on Devnet (needs open internet)
python -m backend.scripts.run_demo

# or just stand up the 3 pools and capture seeds/ids for .env
python -m backend.scripts.bootstrap_devnet

# run the API
uvicorn backend.main:app --reload
```

> **Network note:** the lending amendment is Devnet-only, and Devnet is reachable
> over normal internet. `validate_offline.py` proves construction/signing offline;
> `run_demo.py` / `bootstrap_devnet.py` must run on a machine with internet access.

## Pools (MVP)
| Pool | Risk | First-loss buffer | Base APR |
|------|------|-------------------|----------|
| Conservative | low | 20% | 4% |
| Balanced | medium | 10% | 8% |
| High-Yield | high | 5% | 14% |

## Status
Scaffold + chain service layer in place (M0–M1). Vault/broker/loan flows wired to
`xrpl-py`; live end-to-end Devnet run and React dashboard are next. See SPEC.md §10.
