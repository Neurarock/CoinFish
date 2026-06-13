"""CoinFish FastAPI app entrypoint.

Run (from the CoinFish/ root):
    pip install -r backend/requirements.txt
    uvicorn backend.main:app --reload

Mounts the role routers (auth, pools, lenders, borrowers, loans, admin). The
chain service layer (xrpl_service) is verified live on Devnet; by default the
routers run in off-chain demo mode so the whole UI journey is clickable without
network — set COINFISH_LIVE_CHAIN=1 to route the same actions through Devnet.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config, db
from .routers import admin, auth, borrowers, lenders, loans, pools

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
