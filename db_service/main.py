"""CoinFish Postgres DB microservice — CRUD over lenders, borrowers, pools, partners, transactions."""
from __future__ import annotations

from fastapi import FastAPI

from .routers import router as api_router

app = FastAPI(
    title="CoinFish DB Service",
    version="0.1.0",
    description="SQLAlchemy + Postgres microservice for core CoinFish records. Schema via Alembic.",
)
app.include_router(api_router)


@app.get("/health")
def health():
    return {"ok": True, "service": "coinfish-db"}
