"""Persisted XRPL transaction records."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session, desc, select

from ..db import Account, OnChainTx
from ..schemas import OnChainTxOut
from ..services import current_account, session_dep, tx_out

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("/me", response_model=list[OnChainTxOut])
def mine(
    acct: Account = Depends(current_account),
    session: Session = Depends(session_dep),
) -> list[dict]:
    rows = session.exec(
        select(OnChainTx)
        .where(OnChainTx.account_id == acct.id)
        .order_by(desc(OnChainTx.created_at))
    ).all()
    return [tx_out(r) for r in rows]


@router.get("", response_model=list[OnChainTxOut])
def all_transactions(session: Session = Depends(session_dep)) -> list[dict]:
    rows = session.exec(select(OnChainTx).order_by(desc(OnChainTx.created_at))).all()
    return [tx_out(r) for r in rows]
