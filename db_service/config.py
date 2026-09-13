"""Postgres URL + settings for the CoinFish DB microservice."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Repo-root env files (works whether cwd is root or db_service/).
_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(_ROOT / ".env")
load_dotenv(_ROOT / ".env.local", override=True)


def _normalize_postgres_url(url: str) -> str:
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://") :]
    if url.startswith("postgresql://") and "+psycopg" not in url:
        return "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


def resolve_database_url() -> str:
    """Resolve the DB URL for the persistence service + Alembic.

    Prefer an explicit override, then the ephemeral Neon *dev branch*
    (`NEON_DEV`, auto-expires — for migration / schema experiments), then the
    stable Neon URL, then local Docker Postgres.
    """
    url = (
        os.getenv("COINFISH_POSTGRES_URL")
        or os.getenv("COINFISH_DB_URL")
        or os.getenv("DATABASE_URL")
        or os.getenv("NEON_DEV")
        or os.getenv("NEON")
        or "postgresql+psycopg://coinfish:coinfish@127.0.0.1:5433/coinfish"
    )
    return _normalize_postgres_url(url)


DATABASE_URL = resolve_database_url()
SERVICE_HOST = os.getenv("DB_SERVICE_HOST", "127.0.0.1")
SERVICE_PORT = int(os.getenv("DB_SERVICE_PORT", "8001"))
