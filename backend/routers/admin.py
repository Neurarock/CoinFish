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

from .. import config
from ..db import Account, Deposit, FiatLedger, Loan, LoanStatus, Role
from ..runtime import rt
from ..schemas import AdminDashboardOut, GraceExtendIn, LoanDefaultIn
from ..services import (
    collateral_balance,
    collateral_locked,
    explorer_account,
    explorer_tx,
    record_onchain_tx,
    require_devnet_transactions,
    require_role,
    session_dep,
)
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


@router.get("/accounts")
def accounts(session: Session = Depends(session_dep)) -> dict:
    """Participant registry for the CoinFish operator view.

    Logs every signed-up company (the off-chain KYC record) alongside their
    on-chain identity (XRPL account + XLS-70 credential) and their live
    position: lenders' deposits, borrowers' pledged collateral and borrowing.
    Also returns the permissioned-domain / access-list links.
    """
    rows = session.exec(select(Account)).all()
    out = []
    for a in rows:
        rec = {
            "id": a.id, "role": a.role.value, "company_name": a.company_name,
            "email": a.email, "company_number": "",
            "kyc_status": a.kyc_status.value, "credit_status": a.credit_status.value,
            "credit_score": a.credit_score,
            "xrpl_address": a.xrpl_address,
            "account_explorer_url": explorer_account(a.xrpl_address),
            "credential_id": a.credential_id or "",
            "credential_explorer_url": explorer_tx(a.credential_id) if a.credential_id else "",
            "wallet_rlusd_balance": round(a.wallet_rlusd_balance or 0.0, 2),
        }
        if a.role == Role.LENDER:
            deps = session.exec(select(Deposit).where(Deposit.account_id == a.id)).all()
            by_pool: dict[str, float] = {}
            for d in deps:
                by_pool[d.pool_key] = round(by_pool.get(d.pool_key, 0.0) + d.principal, 2)
            rec["lending"] = {
                "total_deposited": round(sum(d.principal for d in deps), 2),
                "by_pool": by_pool,
            }
        else:
            coll = collateral_balance(session, a.id)
            locked = collateral_locked(session, a.id)
            loans = session.exec(select(Loan).where(Loan.account_id == a.id)).all()
            active = [l for l in loans if l.status == LoanStatus.ACTIVE]
            rec["borrowing"] = {
                "collateral_pledged": coll,
                "collateral_locked": locked,
                "collateral_available": round(coll - locked, 2),
                "outstanding": round(sum(l.principal for l in active), 2),
                "active_loans": len(active),
                "total_loans": len(loans),
                "interest_paid": round(sum(l.interest_paid for l in loans), 2),
            }
        out.append(rec)

    op = rt.operator_address
    permission = {
        "domain_id": rt.domain_id,
        "issuer_address": rt.issuer_address,
        "issuer_explorer_url": explorer_account(rt.issuer_address),
        "operator_address": op,
        "operator_explorer_url": explorer_account(op),
        # the permissioned domain + credentials are administered from the
        # operator account; the explorer renders accounts, not raw objects.
        "permission_list_explorer_url": explorer_account(op),
    }
    return {"permission": permission, "accounts": out,
            "lenders": sum(1 for a in rows if a.role == Role.LENDER),
            "borrowers": sum(1 for a in rows if a.role == Role.BORROWER)}


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


@router.post("/loans/default")
def operator_default(body: LoanDefaultIn, session: Session = Depends(session_dep)) -> dict:
    """CoinFish (the loan-broker owner) defaults a past-grace loan.

    Ledger ownership: the on-chain Loan object lives under the LoanBroker, which
    is owned by the CoinFish operator account, so only the operator can submit
    LoanManage(tfLoanDefault). The XRPL ledger additionally enforces that the
    payment is past its due date + grace period, so this only succeeds once the
    grace window has actually lapsed. On success, first-loss cover is drawn and
    any residual loss is socialised across the vault's shares on-chain; off-chain
    we mark the loan defaulted and seize the borrower's pledged fiat collateral.
    """
    require_devnet_transactions("Loan default")
    loan = session.get(Loan, body.loan_id)
    if not loan:
        raise HTTPException(404, "loan not found")
    if loan.status != LoanStatus.ACTIVE:
        raise HTTPException(400, f"loan is {loan.status.value}")
    if not loan.xrpl_loan_id:
        raise HTTPException(400, "loan has no XRPL loan id; cannot default on-chain")
    default_charge = round(loan.principal * 0.05 + config.FIXED_SERVICE_FEE, 2)
    from ..xrpl_service import loan as loan_svc
    from ..xrpl_service.client import get_client, wallet_from_seed
    client = get_client()
    res = loan_svc.default_loan(wallet_from_seed(rt.operator_seed), loan.xrpl_loan_id, client)
    if not res.ok:
        raise HTTPException(
            409,
            "XRPL rejected the default — the loan must be past its due date + grace "
            f"period before LoanManage(default) is valid: {res.engine_result}",
        )
    tx_hash = res.hash
    record_onchain_tx(
        session,
        account_id=loan.account_id,
        action="loan_default",
        tx_hash=tx_hash,
        engine_result=res.engine_result,
        pool_key=loan.pool_key,
        loan_id=loan.id,
        amount=loan.principal,
    )
    loan.default_charge = default_charge
    loan.status = LoanStatus.DEFAULTED
    rt.pools[loan.pool_key].drawn = max(0.0, rt.pools[loan.pool_key].drawn - loan.principal)
    rt.fees_collected += default_charge
    session.add(FiatLedger(account_id=loan.account_id, entry_type="default_charge",
                           amount=-(loan.principal + default_charge),
                           reference=f"loan {loan.id} operator default"))
    session.add(loan)
    session.commit()
    return {"ok": True, "status": "defaulted", "loan_id": loan.id,
            "default_charge": default_charge,
            "collateral_seized": round(loan.principal + default_charge, 2),
            "tx_hash": tx_hash, "explorer_url": explorer_tx(tx_hash)}
