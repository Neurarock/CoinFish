"""Vercel serverless entrypoint.

Vercel routes /api/* here. We mount the existing backend FastAPI app at /api so
the deployed frontend can call the same same-origin URLs it uses locally.
"""
from __future__ import annotations

import os

from fastapi import FastAPI

# Serverless filesystems are ephemeral and instances aren't shared, so a /tmp
# SQLite file silently loses every account/loan between requests. If a managed
# database is configured (Vercel Postgres / Neon / Supabase expose one of these
# env vars), use it for durable, shared state. Only fall back to writable /tmp
# SQLite when nothing persistent is available.
_PERSISTENT = ("COINFISH_DB_URL", "DATABASE_URL", "POSTGRES_URL_NON_POOLING", "POSTGRES_URL", "NEON")
if not any(os.getenv(k) for k in _PERSISTENT):
    os.environ["COINFISH_DB_URL"] = "sqlite:////tmp/coinfish.db"

from backend import db  # noqa: E402
from backend.main import app as backend_app  # noqa: E402

app = FastAPI(title="CoinFish Vercel Gateway")

# Initialise tables at import time too (not just on startup) so the very first
# serverless invocation has its schema ready.
db.init_db()


@app.on_event("startup")
def _startup() -> None:
    db.init_db()


app.mount("/api", backend_app)
