"""Shared service helpers: auth, fiat-ledger math, account serialisation.

Auth here is intentionally lightweight (demo tokens, salted-hash passwords) —
enough to keep three concurrent roles separated in the dashboard, not production
identity. Tokens are opaque random strings mapped to account ids in memory.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime

from fastapi import Depends, Header, HTTPException
from sqlmodel import Session, select

from . import config
from . import db
from .db import Account, AuthSession, CheckStatus, FiatLedger, Role
from .schemas import AccountOut

# in-memory token store: token -> account_id (demo only)
_TOKENS: dict[str, int] = {}


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(8)
    digest = hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    if "$" not in stored:
        return False
    salt, _ = stored.split("$", 1)
    return hash_password(password, salt) == stored


def issue_token(account_id: int, session: Session | None = None) -> str:
    token = secrets.token_urlsafe(24)
    _TOKENS[token] = account_id
    if session is not None:
        session.add(AuthSession(token=token, account_id=account_id))
        session.commit()
    return token


def session_dep():
    with db.get_session() as s:
        yield s


def current_account(
    authorization: str = Header(default=""),
    session: Session = Depends(session_dep),
) -> Account:
    token = authorization.replace("Bearer ", "").strip()
    account_id = _TOKENS.get(token)
    if not account_id and token:
        row = session.get(AuthSession, token)
        if row:
            account_id = row.account_id
            _TOKENS[token] = account_id
    if not account_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    acct = session.get(Account, account_id)
    if not acct:
        raise HTTPException(status_code=401, detail="Unknown account")
    return acct


def require_role(role: Role):
    def _dep(acct: Account = Depends(current_account)) -> Account:
        if acct.role != role:
            raise HTTPException(status_code=403, detail=f"Requires {role.value} role")
        return acct
    return _dep


# --- fiat ledger -------------------------------------------------------------
# Entries that move actual fiat in/out of CoinFish custody. `lock`/`release` are
# informational only (they ring-fence collateral behind a live loan) and must NOT
# move the custody balance, or collateral would be double-counted.
_CUSTODY_TYPES = {"deposit", "withdraw", "default_charge", "recover"}


def collateral_balance(session: Session, account_id: int) -> float:
    """Total fiat CoinFish holds in custody for this borrower."""
    rows = session.exec(select(FiatLedger).where(FiatLedger.account_id == account_id)).all()
    return round(sum(r.amount for r in rows if r.entry_type in _CUSTODY_TYPES), 2)


def collateral_locked(session: Session, account_id: int) -> float:
    """Collateral ring-fenced behind live loans (lock minus release)."""
    rows = session.exec(select(FiatLedger).where(FiatLedger.account_id == account_id)).all()
    locked = sum(r.amount for r in rows if r.entry_type == "lock")
    released = sum(r.amount for r in rows if r.entry_type == "release")
    return round(abs(locked) - abs(released), 2)


def account_out(acct: Account) -> AccountOut:
    return AccountOut(
        id=acct.id,
        role=acct.role.value,
        company_name=acct.company_name,
        email=acct.email,
        kyc_status=acct.kyc_status.value,
        credit_status=acct.credit_status.value,
        credit_score=acct.credit_score,
        xrpl_address=acct.xrpl_address,
        wallet_provider=acct.wallet_provider,
        wallet_rlusd_balance=round(acct.wallet_rlusd_balance or 0.0, 2),
        wallet_explorer_url=explorer_account(acct.xrpl_address) if acct.xrpl_address else "",
        wallet_connected=bool(acct.xrpl_address),
    )


def explorer_account(address: str) -> str:
    return f"{config.EXPLORER}/accounts/{address}" if address else ""


def explorer_tx(tx_hash: str) -> str:
    return f"{config.EXPLORER}/transactions/{tx_hash}" if tx_hash else ""


def adjust_wallet_balance(session: Session, acct: Account, delta: float) -> None:
    """Move the persisted demo RLUSD wallet balance."""
    acct.wallet_rlusd_balance = round((acct.wallet_rlusd_balance or 0.0) + delta, 2)
    session.add(acct)


def set_wallet_connected(
    session: Session,
    acct: Account,
    *,
    provider: str,
    address: str,
    seed: str = "",
    balance: float = 0.0,
) -> None:
    acct.wallet_provider = provider
    acct.xrpl_address = address
    acct.xrpl_seed = seed
    acct.wallet_rlusd_balance = round(balance, 2)
    acct.wallet_connected_at = datetime.utcnow()
    session.add(acct)
