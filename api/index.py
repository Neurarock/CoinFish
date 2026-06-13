"""Vercel serverless entrypoint.

Vercel routes /api/* here. We mount the existing backend FastAPI app at /api so
the deployed frontend can call the same same-origin URLs it uses locally.
"""
from __future__ import annotations

import os

from fastapi import FastAPI

# Serverless filesystems are ephemeral. This keeps the proof-of-concept demo
# writable on Vercel previews; use Postgres/Neon/Supabase for durable state.
os.environ.setdefault("COINFISH_DB_URL", "sqlite:////tmp/coinfish.db")

from backend import db  # noqa: E402
from backend.main import app as backend_app  # noqa: E402

app = FastAPI(title="CoinFish Vercel Gateway")


@app.on_event("startup")
def _startup() -> None:
    db.init_db()


app.mount("/api", backend_app)
