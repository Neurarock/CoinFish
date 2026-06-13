"""CoinFish FastAPI app entrypoint.

Run (from the CoinFish/ root):
    pip install -r backend/requirements.txt
    python3 -m backend.scripts.bootstrap_devnet
    uvicorn backend.main:app --reload

Mounts the role routers (auth, pools, lenders, borrowers, loans, admin). The
chain service layer (xrpl_service) submits frontend-driven wallet/vault/loan
actions to XRPL Devnet and records their explorer links.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config, db
from .routers import admin, auth, borrowers, lenders, loans, pools, runtime_status, transactions

app = FastAPI(title="CoinFish", version="0.2.0")

# the three themed frontends run on the Vite dev server during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],            # demo only; tighten for any real deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    db.init_db()


@app.get("/")
def root() -> dict:
    return {
        "service": "CoinFish",
        "network": "XRPL Devnet",
        "stablecoin": config.STABLECOIN_CODE,
        "pools": [p.key for p in config.POOLS],
    }


app.include_router(auth.router)
app.include_router(pools.router)
app.include_router(lenders.router)
app.include_router(borrowers.router)
app.include_router(loans.router)
app.include_router(admin.router)
app.include_router(runtime_status.router)
app.include_router(transactions.router)
