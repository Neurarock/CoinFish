"""Postgres URL + settings for the CoinFish DB microservice."""
from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()


def resolve_database_url() -> str:
    url = (
        os.getenv("COINFISH_POSTGRES_URL")
        or os.getenv("COINFISH_DB_URL")
        or os.getenv("DATABASE_URL")
        or "postgresql+psycopg://coinfish:coinfish@127.0.0.1:5433/coinfish"
    )
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://") :]
    elif url.startswith("postgresql://") and "+psycopg" not in url:
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


DATABASE_URL = resolve_database_url()
SERVICE_HOST = os.getenv("DB_SERVICE_HOST", "127.0.0.1")
SERVICE_PORT = int(os.getenv("DB_SERVICE_PORT", "8001"))
