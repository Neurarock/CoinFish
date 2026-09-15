"""CoinFish FastAPI app entrypoint (product BFF microservice).

Run (from the CoinFish/ root):
    uv sync --all-packages
    uv run python -m backend.scripts.bootstrap_devnet
    uv run uvicorn backend.main:app --reload

Mounts the role routers (auth, pools, lenders, borrowers, loans, admin). The
chain service layer (xrpl_service) submits frontend-driven wallet/vault/loan
actions to XRPL Devnet and records their explorer links.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import config, db
from .routers import admin, auth, borrowers, lenders, loans, pools, runtime_status, transactions

app = FastAPI(title="CoinFish", version="0.2.0")
_log = logging.getLogger("coinfish")


@app.exception_handler(Exception)
async def _unhandled(request: Request, exc: Exception):
    """Starlette's default 500 is plaintext 'Internal Server Error', which the
    frontend JSON.parse()s into 'Unexpected token I'. Always return JSON."""
    if isinstance(exc, StarletteHTTPException):
        return await http_exception_handler(request, exc)
    _log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})

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
    from urllib.parse import urlparse
    parsed = urlparse(db.DB_URL)
    target = parsed.hostname or parsed.path or "unknown"
    print(f"CoinFish DB → {db.engine.dialect.name} ({target})")
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
