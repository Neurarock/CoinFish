"""CoinFish (vault operator) dashboard: fees, solvency, risk score, grace control.

This is the company's own view. It aggregates fee revenue, computes whether the
platform is 'underwater' (on-chain liabilities to lenders exceed assets backing
them), derives a composite risk score from pool utilisation + first-loss coverage
+ at-risk loans, and surfaces the critical section: loans in their grace window
that are about to default, with a control to extend the grace period.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..db import Account, Loan, LoanStatus, Role
from ..runtime import rt
from ..schemas import AdminDashboardOut, GraceExtendIn
from ..services import require_role, session_dep
from .pools import pool_out

router = APIRouter(prefix="/admin", tags=["admin"])
admin_only = require_role(Role.ADMIN)

# a loan is "at risk" if it is within this window of its due date
GRACE_WINDOW_HOURS = 6.0


def _risk_score() -> tuple[float, str]:
    """Composite 0..100 risk score (higher = riskier) from pool metrics."""
    total_tvl = sum(p.tvl for p in rt.pools.values()) or 1.0
    util = sum(p.drawn for p in rt.pools.values()) / total_tvl
    cover = sum(p.first_loss_capital for p in rt.pools.values()) / total_tvl
    # high utilisation pushes risk up; thick first-loss cover pulls it down
    score = max(0.0, min(100.0, util * 70 + (0.15 - min(cover, 0.15)) / 0.15 * 30))
    band = "low" if score < 33 else "elevated" if score < 66 else "critical"
    return round(score, 1), band


@router.get("/dashboard", response_model=AdminDashboardOut)
def dashboard(session: Session = Depends(session_dep)) -> AdminDashboardOut:
    # NOTE: admin auth is relaxed for the demo; gate with admin_only in prod.
    total_tvl = round(sum(p.tvl for p in rt.pools.values()), 2)
    total_drawn = round(sum(p.drawn for p in rt.pools.values()), 2)
    total_flc = round(sum(p.first_loss_capital for p in rt.pools.values()), 2)
    # solvency: assets (idle + first-loss) vs liabilities owed to lenders (TVL)
    assets = (total_tvl - total_drawn) + total_flc + rt.fees_collected
    liabilities = total_tvl
    solvency = round(assets / liabilities, 3) if liabilities else 1.0
    underwater = solvency < 1.0
    score, band = _risk_score()

    now = datetime.utcnow()
    at_risk = []
    active = session.exec(select(Loan).where(Loan.status == LoanStatus.ACTIVE)).all()
    for l in active:
        if not l.due_at:
            continue
        due = l.due_at + timedelta(hours=l.grace_extra_hours)
        hrs_left = (due - now).total_seconds() / 3600
        if hrs_left <= GRACE_WINDOW_HOURS:
            at_risk.append({
                "loan_id": l.id, "account_id": l.account_id, "pool_key": l.pool_key,
                "principal": l.principal, "hours_to_default": round(hrs_left, 2),
                "grace_extra_hours": l.grace_extra_hours,
                "in_grace": hrs_left < 0,
            })

    return AdminDashboardOut(
        fees_collected=round(rt.fees_collected, 2),
        total_tvl=total_tvl,
        total_drawn=total_drawn,
        total_first_loss=total_flc,
        underwater=underwater,
        solvency_ratio=solvency,
        risk_score=score,
        risk_band=band,
        pools=[pool_out(k).model_dump() for k in rt.pools],
        at_risk_loans=at_risk,
    )


@router.post("/loans/grace")
def extend_grace(body: GraceExtendIn, session: Session = Depends(session_dep)) -> dict:
    loan = session.get(Loan, body.loan_id)
    if not loan:
        raise HTTPException(404, "loan not found")
    if body.hours <= 0:
        raise HTTPException(400, "hours must be positive")
    loan.grace_extra_hours += body.hours
    session.add(loan)
    session.commit()
    return {"ok": True, "loan_id": loan.id, "grace_extra_hours": loan.grace_extra_hours}
