"""Alembic migration upgrade / downgrade tests.

Default suite uses a temp SQLite DB. Optional Neon coverage runs when
`NEON_DEV` is set (ephemeral branch that auto-expires — safe for experiments).
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text

DB_SERVICE_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = DB_SERVICE_DIR.parent
ALEMBIC_INI = DB_SERVICE_DIR / "alembic.ini"

EXPECTED_TABLES = {"lenders", "borrowers", "pools", "partners", "transactions", "alembic_version"}

load_dotenv(REPO_ROOT / ".env")
load_dotenv(REPO_ROOT / ".env.local", override=True)


def _normalize_url(url: str) -> str:
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://") :]
    if url.startswith("postgresql://") and "+psycopg" not in url:
        return "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


def _alembic_config(db_url: str) -> Config:
    cfg = Config(str(ALEMBIC_INI))
    cfg.set_main_option("script_location", str(DB_SERVICE_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", db_url)
    return cfg


@pytest.fixture()
def sqlite_url(tmp_path: Path) -> str:
    return f"sqlite:///{tmp_path / 'migrate.db'}"


@pytest.fixture()
def neon_dev_url() -> str:
    raw = os.getenv("NEON_DEV")
    if not raw:
        pytest.skip("NEON_DEV not set — skipping ephemeral Neon migration tests")
    return _normalize_url(raw)


def test_upgrade_creates_all_tables(sqlite_url: str):
    cfg = _alembic_config(sqlite_url)
    command.upgrade(cfg, "head")

    engine = create_engine(sqlite_url)
    tables = set(inspect(engine).get_table_names())
    assert EXPECTED_TABLES.issubset(tables)

    # Spot-check important columns exist after migration.
    cols = {c["name"] for c in inspect(engine).get_columns("lenders")}
    assert {"id", "email", "lender_tier", "password_hash"}.issubset(cols)
    tx_cols = {c["name"] for c in inspect(engine).get_columns("transactions")}
    assert {"lender_id", "borrower_id", "pool_id", "partner_id", "tx_hash"}.issubset(tx_cols)
    engine.dispose()


def test_upgrade_downgrade_upgrade_roundtrip(sqlite_url: str):
    cfg = _alembic_config(sqlite_url)
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")

    engine = create_engine(sqlite_url)
    tables = set(inspect(engine).get_table_names())
    # After full downgrade only alembic_version should remain (or nothing).
    assert "lenders" not in tables
    assert "transactions" not in tables
    engine.dispose()

    command.upgrade(cfg, "head")
    engine = create_engine(sqlite_url)
    tables = set(inspect(engine).get_table_names())
    assert {"lenders", "borrowers", "pools", "partners", "transactions"}.issubset(tables)
    engine.dispose()


def test_migration_head_revision_is_initial(sqlite_url: str):
    cfg = _alembic_config(sqlite_url)
    command.upgrade(cfg, "head")
    engine = create_engine(sqlite_url)
    with engine.connect() as conn:
        version = conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
    assert version == "001_initial"
    engine.dispose()


def test_migrated_schema_accepts_inserts(sqlite_url: str):
    cfg = _alembic_config(sqlite_url)
    command.upgrade(cfg, "head")
    engine = create_engine(sqlite_url)
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO pools (key, name, risk_tier, base_apr, first_loss_pct, "
                "capacity, available_liquidity, status) "
                "VALUES ('low', 'Conservative', 'low', 0.04, 0.1, 1000000, 1000000, 'open')"
            )
        )
        conn.execute(
            text(
                "INSERT INTO lenders (company_name, email, password_hash, lender_tier, "
                "kyc_status, status) VALUES ('L', 'l@ex.com', 'x', 'retail', 'pending', 'active')"
            )
        )
        pool_id = conn.execute(text("SELECT id FROM pools WHERE key='low'")).scalar_one()
        lender_id = conn.execute(text("SELECT id FROM lenders WHERE email='l@ex.com'")).scalar_one()
        conn.execute(
            text(
                "INSERT INTO transactions (action, amount, currency, status, lender_id, pool_id) "
                "VALUES ('deposit', 100, 'RLUSD', 'confirmed', :lid, :pid)"
            ),
            {"lid": lender_id, "pid": pool_id},
        )
        count = conn.execute(text("SELECT COUNT(*) FROM transactions")).scalar_one()
    assert count == 1
    engine.dispose()


def test_neon_dev_upgrade_creates_all_tables(neon_dev_url: str):
    """Live check against the ephemeral Neon branch (NEON_DEV)."""
    cfg = _alembic_config(neon_dev_url)
    command.upgrade(cfg, "head")

    engine = create_engine(neon_dev_url)
    try:
        tables = set(inspect(engine).get_table_names())
        assert EXPECTED_TABLES.issubset(tables)
        with engine.connect() as conn:
            version = conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
        assert version == "001_initial"
    finally:
        engine.dispose()


def test_neon_dev_upgrade_downgrade_upgrade_roundtrip(neon_dev_url: str):
    cfg = _alembic_config(neon_dev_url)
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")

    engine = create_engine(neon_dev_url)
    try:
        tables = set(inspect(engine).get_table_names())
        assert "lenders" not in tables
        assert "transactions" not in tables
    finally:
        engine.dispose()

    command.upgrade(cfg, "head")
    engine = create_engine(neon_dev_url)
    try:
        tables = set(inspect(engine).get_table_names())
        assert {"lenders", "borrowers", "pools", "partners", "transactions"}.issubset(tables)
    finally:
        engine.dispose()
