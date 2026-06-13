"""Read-only loan status lookups (shared by borrower + admin views)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from .. import config
from ..db import Loan
from ..runtime import LIVE_CHAIN, rt
from ..services import explorer_tx, receipt_url, session_dep

router = APIRouter(prefix="/loans", tags=["loans"])


@router.get("/{loan_id}")
def loan_status(loan_id: int, session: Session = Depends(session_dep)) -> dict:
    loan = session.get(Loan, loan_id)
    if not loan:
        raise HTTPException(404, "loan not found")
    out = {
        "id": loan.id,
        "pool_key": loan.pool_key,
        "principal": loan.principal,
        "interest_rate": loan.interest_rate,
        "term_hours": loan.term_hours,
        "interest_paid": round(loan.interest_paid, 2),
        "status": loan.status.value,
        "default_charge": loan.default_charge,
        "xrpl_loan_id": loan.xrpl_loan_id,
        "origination_tx": loan.origination_tx,
        "explorer_url": explorer_tx(loan.origination_tx),
        "receipt_url": receipt_url(loan.origination_tx),
    }
    if LIVE_CHAIN and loan.xrpl_loan_id:
        from ..xrpl_service import loan as loan_svc
        from ..xrpl_service.client import get_client
        out["on_chain"] = loan_svc.loan_status(loan.xrpl_loan_id, get_client())
    return out
