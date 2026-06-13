"""CoinFish FastAPI app entrypoint.

Run (from the CoinFish/ root):
    pip install -r backend/requirements.txt
    uvicorn backend.main:app --reload

Routers are added incrementally per the milestones in SPEC.md (M3+).
"""
from __future__ import annotations

from fastapi import FastAPI

from . import config

app = FastAPI(title="CoinFish", version="0.1.0")


@app.get("/")
def root() -> dict:
    return {
        "service": "CoinFish",
        "network": "XRPL Devnet",
        "stablecoin": config.STABLECOIN_CODE,
        "pools": [p.key for p in config.POOLS],
    }


@app.get("/pools")
def list_pools() -> list[dict]:
    return [
        {
            "key": p.key,
            "name": p.name,
            "risk_tier": p.risk_tier,
            "first_loss_buffer": p.cover_rate_minimum,
            "base_apr": p.base_apr,
        }
        for p in config.POOLS
    ]
