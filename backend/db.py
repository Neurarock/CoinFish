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
from typing import Optional

from sqlalchemy import text
from sqlalchemy.pool import NullPool
from sqlmodel import Field, Session, SQLModel, create_engine


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
        or os.getenv("NEON")            # the name used in this project's env
        or "sqlite:///./coinfish.db"
    )
    # Normalise Postgres scheme variants onto the psycopg (v3) driver.
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


DB_URL = _resolve_db_url()

if DB_URL.startswith("sqlite"):
    engine = create_engine(DB_URL, echo=False, connect_args={"check_same_thread": False})
else:
    # Serverless-friendly: don't keep pooled connections alive between
    # invocations, and validate a connection before using it.
    engine = create_engine(DB_URL, echo=False, pool_pre_ping=True, poolclass=NullPool)


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
    """A signed-up company, either a lender or a borrower."""

    id: Optional[int] = Field(default=None, primary_key=True)
    role: Role
    company_name: str
    email: str = Field(index=True)
    password_hash: str = ""
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
    }
    pg_adds = {
        "wallet_provider": "VARCHAR DEFAULT ''",
        "wallet_rlusd_balance": "DOUBLE PRECISION DEFAULT 0.0",
        "wallet_connected_at": "TIMESTAMP",
        "lender_tier": "VARCHAR DEFAULT 'retail'",
    }
    with engine.begin() as conn:
        if engine.dialect.name == "sqlite":
            cols = {row[1] for row in conn.execute(text("PRAGMA table_info(account)"))}
            for name, ddl in sqlite_adds.items():
                if name not in cols:
                    conn.execute(text(f"ALTER TABLE account ADD COLUMN {name} {ddl}"))
        else:  # postgres et al. support ADD COLUMN IF NOT EXISTS
            for name, ddl in pg_adds.items():
                try:
                    conn.execute(text(f"ALTER TABLE account ADD COLUMN IF NOT EXISTS {name} {ddl}"))
                except Exception:
                    pass
