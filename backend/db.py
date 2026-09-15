"""Off-chain state (SQLite via SQLModel).

The XRPL ledger is the source of truth for *on-chain* state (vault balances,
loan objects, credentials). This DB holds only what the chain can't or shouldn't:
company/KYC records, the fiat collateral ledger, credit policy, the user<->wallet
mapping, and demo bookkeeping (quotes, exit-queue rows) so the dashboards have
something stable to render between ledger reads.

Everything here is Devnet/demo data. No production PII handling.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.pool import NullPool
from sqlmodel import Field, Session, SQLModel, create_engine

_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(_ROOT / ".env")
load_dotenv(_ROOT / ".env.local", override=True)


def _resolve_db_url() -> str:
    """Pick the database URL, preferring a managed Postgres if one is provided.

    Serverless platforms (Vercel) hand a connection string via one of several env
    vars. We accept any of them so the deployed app uses a *persistent* database
    instead of an ephemeral per-instance SQLite file (which silently loses every
    account/loan between requests). Locally, with none set, we fall back to a
    SQLite file next to the backend package.
    """
    url = (
        os.getenv("COINFISH_DB_URL")
        or os.getenv("DATABASE_URL")
        or os.getenv("POSTGRES_URL_NON_POOLING")
        or os.getenv("POSTGRES_URL")
        or os.getenv("NEON")            # stable Neon URL (Vercel / durable)
        or os.getenv("NEON_DEV")        # ephemeral Neon branch (migration experiments)
        or "sqlite:///./coinfish.db"
    )
    # Normalise Postgres scheme variants onto the psycopg (v3) driver.
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


DB_URL = _resolve_db_url()

# libpq default connect can hang well past a minute when Neon compute is
# asleep or unreachable. Fail fast so uvicorn can still bind :8000.
_PG_CONNECT_ARGS = {"connect_timeout": 10}

if DB_URL.startswith("sqlite"):
    engine = create_engine(DB_URL, echo=False, connect_args={"check_same_thread": False})
elif os.getenv("VERCEL"):
    # Serverless: don't keep pooled connections alive between invocations.
    engine = create_engine(
        DB_URL, echo=False, pool_pre_ping=True, poolclass=NullPool,
        connect_args=_PG_CONNECT_ARGS,
    )
else:
    # Local/dev: reuse connections. NullPool opened a new TLS session for
    # every ALTER during startup and blocked the API for 30s+.
    engine = create_engine(
        DB_URL, echo=False, pool_pre_ping=True,
        pool_size=5, max_overflow=10, pool_timeout=10,
        connect_args=_PG_CONNECT_ARGS,
    )


# --- enums -------------------------------------------------------------------
class Role(str, Enum):
    LENDER = "lender"
    BORROWER = "borrower"
    ADMIN = "admin"


class CheckStatus(str, Enum):
    PENDING = "pending"     # orange button in the UI
    PASSED = "passed"       # green button in the UI
    NOT_REQUIRED = "n/a"    # lenders skip the credit check


class LoanStatus(str, Enum):
    QUOTED = "quoted"
    ACTIVE = "active"
    REPAID = "repaid"
    DEFAULTED = "defaulted"


# --- tables ------------------------------------------------------------------
class Account(SQLModel, table=True):
    """A signed-up company. One login can hold several kinds of access."""

    id: Optional[int] = Field(default=None, primary_key=True)
    role: Role                       # first product surface they enrolled in
    can_lend: bool = False
    can_borrow: bool = False
    can_partner: bool = False
    company_name: str
    email: str = Field(index=True)
    password_hash: str = ""
    neon_user_id: str = ""           # Managed Better Auth user id (empty = demo password account)
    # signup gating buttons (orange -> green in the UI)
    kyc_status: CheckStatus = CheckStatus.PENDING
    credit_status: CheckStatus = CheckStatus.PENDING
    credit_score: int = 0            # filled by the simulated credit check
    lender_tier: str = "retail"      # accreditation tier gating which pools a lender may enter
    # connected XRPL wallet (a Devnet faucet wallet / simulated external signer)
    xrpl_address: str = ""
    xrpl_seed: str = ""              # Devnet throwaway only
    wallet_provider: str = ""        # xaman | crossmark | gemwallet | devnet
    wallet_rlusd_balance: float = 0.0
    wallet_connected_at: Optional[datetime] = None
    credential_id: str = ""          # set once the borrower credential is accepted
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AuthSession(SQLModel, table=True):
    """Persisted demo session token so browser refresh survives backend restarts."""

    token: str = Field(primary_key=True)
    account_id: int = Field(index=True, foreign_key="account.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class FiatLedger(SQLModel, table=True):
    """The borrower's off-chain fiat collateral — the whole point of CoinFish.

    entry_type: deposit | withdraw | lock | release | default_charge | recover.
    The running sum of signed amounts is the borrower's available collateral.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    account_id: int = Field(index=True, foreign_key="account.id")
    entry_type: str
    amount: float                    # GBP; positive = collateral in, negative = out
    reference: str = ""              # e.g. bank reference shown on the QR transfer
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Deposit(SQLModel, table=True):
    """A lender's deposit into one pool's vault (their share position)."""

    id: Optional[int] = Field(default=None, primary_key=True)
    account_id: int = Field(index=True, foreign_key="account.id")
    pool_key: str
    principal: float                 # RLUSD supplied
    shares: float = 0.0              # vault shares (MPT) received
    deposit_tx: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Loan(SQLModel, table=True):
    """A borrower loan, mirroring the on-chain Loan object plus off-chain policy."""

    id: Optional[int] = Field(default=None, primary_key=True)
    account_id: int = Field(index=True, foreign_key="account.id")
    pool_key: str
    principal: float
    interest_rate: float             # annualised fraction
    term_hours: int
    origination_fee: float
    interest_paid: float = 0.0
    status: LoanStatus = LoanStatus.QUOTED
    default_charge: float = 0.0
    xrpl_loan_id: str = ""
    origination_tx: str = ""
    grace_extra_hours: int = 0       # admin-granted grace extension
    created_at: datetime = Field(default_factory=datetime.utcnow)
    due_at: Optional[datetime] = None


class ExitRow(SQLModel, table=True):
    """A persisted lender exit (withdrawal) request, mirrors exit_queue.ExitRequest."""

    id: Optional[int] = Field(default=None, primary_key=True)
    account_id: int = Field(index=True, foreign_key="account.id")
    pool_key: str
    amount_requested: float
    amount_filled: float = 0.0
    status: str = "pending"          # pending | partial | filled
    created_at: datetime = Field(default_factory=datetime.utcnow)


class OnChainTx(SQLModel, table=True):
    """Every XRPL transaction submitted by the frontend-driven API."""

    id: Optional[int] = Field(default=None, primary_key=True)
    account_id: Optional[int] = Field(default=None, index=True, foreign_key="account.id")
    action: str = Field(index=True)
    tx_hash: str = Field(index=True)
    explorer_url: str
    engine_result: str = ""
    pool_key: str = ""
    loan_id: Optional[int] = Field(default=None, index=True)
    amount: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _ensure_account_columns()


def get_session() -> Session:
    return Session(engine)


def _ensure_account_columns() -> None:
    """create_all does not add new columns to an existing table, so backfill the
    ones added after the first demo DB was created (works on SQLite + Postgres)."""
    sqlite_adds = {
        "wallet_provider": "VARCHAR DEFAULT ''",
        "wallet_rlusd_balance": "FLOAT DEFAULT 0.0",
        "wallet_connected_at": "DATETIME",
        "lender_tier": "VARCHAR DEFAULT 'retail'",
        "neon_user_id": "VARCHAR DEFAULT ''",
        "can_lend": "BOOLEAN DEFAULT 0",
        "can_borrow": "BOOLEAN DEFAULT 0",
        "can_partner": "BOOLEAN DEFAULT 0",
    }
    pg_adds = {
        "wallet_provider": "VARCHAR DEFAULT ''",
        "wallet_rlusd_balance": "DOUBLE PRECISION DEFAULT 0.0",
        "wallet_connected_at": "TIMESTAMP",
        "lender_tier": "VARCHAR DEFAULT 'retail'",
        "neon_user_id": "VARCHAR DEFAULT ''",
        "can_lend": "BOOLEAN DEFAULT FALSE",
        "can_borrow": "BOOLEAN DEFAULT FALSE",
        "can_partner": "BOOLEAN DEFAULT FALSE",
    }
    if engine.dialect.name == "sqlite":
        with engine.begin() as conn:
            cols = {row[1] for row in conn.execute(text("PRAGMA table_info(account)"))}
            for name, ddl in sqlite_adds.items():
                if name not in cols:
                    conn.execute(text(f"ALTER TABLE account ADD COLUMN {name} {ddl}"))
            _backfill_access_flags(conn, postgres=False)
        return

    # Inspect once, then ALTER only missing columns in a single connection.
    # (A failed statement still aborts the Postgres transaction, so we must
    # not run ADD COLUMN IF NOT EXISTS in a loop that can error mid-way.)
    with engine.begin() as conn:
        cols = {
            row[0]
            for row in conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema = current_schema() AND table_name = 'account'"
            ))
        }
        for name, ddl in pg_adds.items():
            if name not in cols:
                conn.execute(text(f"ALTER TABLE account ADD COLUMN {name} {ddl}"))
        _backfill_access_flags(conn, postgres=True)


def _backfill_access_flags(conn, *, postgres: bool) -> None:
    """Grant the matching flag to rows that only have a legacy exclusive role.

    Neon stored Role as the enum *name* ('LENDER') in some environments and the
    *value* ('lender') in others, so match case-insensitively.
    """
    role_expr = "lower(role::text)" if postgres else "lower(role)"
    true_lit = "TRUE" if postgres else "1"
    unset = (
        "COALESCE(can_lend, FALSE) = FALSE AND COALESCE(can_borrow, FALSE) = FALSE"
        if postgres
        else "IFNULL(can_lend, 0) = 0 AND IFNULL(can_borrow, 0) = 0"
    )
    conn.execute(text(
        f"UPDATE account SET can_lend = {true_lit} WHERE {role_expr} = 'lender' AND {unset}"
    ))
    conn.execute(text(
        f"UPDATE account SET can_borrow = {true_lit} WHERE {role_expr} = 'borrower' AND {unset}"
    ))
