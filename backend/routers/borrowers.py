"""Borrower flow: collateral, eligibility, live quotes, loans, repay, default.

The borrower's fiat deposit is their off-chain collateral (FiatLedger). Eligibility
for each pool is derived from collateral and current loan-to-value (LTV). Quotes
are live for 5 seconds (runtime.QUOTE_TTL); accepting a live quote originates a
loan (LoanSet) that disburses RLUSD to the borrower's connected wallet.
"""
from __future__ import annotations

import time
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from .. import config, risk_engine
from ..db import Account, FiatLedger, Loan, LoanStatus, Role
from ..runtime import rt
from ..schemas import (
    AcceptQuoteIn,
    BankTransferOut,
    BorrowerDashboardOut,
    CollateralTopupIn,
    CollateralWithdrawIn,
    QuoteIn,
    QuoteOut,
    RepayIn,
)
from ..services import (
    account_out,
    collateral_balance,
    collateral_locked,
    explorer_object,
    explorer_tx,
    record_onchain_tx,
    require_devnet_transactions,
    require_role,
    session_dep,
)

router = APIRouter(prefix="/borrowers", tags=["borrowers"])
borrower_only = require_role(Role.BORROWER)

# minimum term that must elapse before a full (non-interest) repayment is allowed
MIN_TERM_FRACTION = 0.5  # must hold the loan at least half its term


def _credit_limit(collateral: float) -> float:
    """Off-chain credit policy: lend up to 80% of available fiat collateral."""
    return round(collateral * 0.80, 2)


def _eligible_pools(session: Session, acct: Account) -> list[dict]:
    available = collateral_balance(session, acct.id) - collateral_locked(session, acct.id)
    limit = _credit_limit(available)
    outstanding = _outstanding(session, acct.id)
    out = []
    for key, pool in rt.pools.items():
        headroom = round(max(0.0, limit - outstanding), 2)
        ltv = 0.0 if available <= 0 else round(outstanding / available, 4)
        eligible = bool(acct.credential_id or acct.kyc_status.value == "passed") and headroom > 0
        out.append({
            "key": key, "name": pool.name, "risk_tier": pool.risk_tier,
            "base_apr": pool.base_apr, "available_liquidity": round(pool.available, 2),
            "max_borrow": headroom, "current_ltv": ltv, "eligible": eligible,
        })
    return out


def _outstanding(session: Session, account_id: int) -> float:
    loans = session.exec(
        select(Loan).where(Loan.account_id == account_id, Loan.status == LoanStatus.ACTIVE)
    ).all()
    return round(sum(l.principal for l in loans), 2)


# --- collateral --------------------------------------------------------------
@router.post("/collateral/topup", response_model=BankTransferOut)
def topup_intent(body: CollateralTopupIn, acct: Account = Depends(borrower_only)):
    """Return simulated UK bank-transfer details + a QR payload for a fiat top-up.

    In the demo the frontend shows these, renders the QR, then calls
    /collateral/confirm to credit the fiat ledger (as if the transfer landed).
    """
    if body.amount <= 0:
        raise HTTPException(400, "amount must be positive")
    reference = f"CF-{acct.id:04d}-{int(time.time()) % 100000:05d}"
    qr = (f"bank://transfer?name=CoinFish%20Custody%20Ltd&sort=04-00-72"
          f"&acc=12345678&amount={body.amount:.2f}&ref={reference}")
    return BankTransferOut(
        amount=round(body.amount, 2),
        account_name="CoinFish Custody Ltd",
        sort_code="04-00-72",
        account_number="12345678",
        reference=reference,
        qr_payload=qr,
    )


@router.post("/collateral/confirm")
def topup_confirm(body: CollateralTopupIn, acct: Account = Depends(borrower_only),
                  session: Session = Depends(session_dep)) -> dict:
    """Credit the fiat ledger once the simulated bank transfer 'arrives'."""
    ref = f"CF-{acct.id:04d}-{int(time.time()) % 100000:05d}"
    session.add(FiatLedger(account_id=acct.id, entry_type="deposit",
                           amount=round(body.amount, 2), reference=ref))
    session.commit()
    bal = collateral_balance(session, acct.id)
    return {"ok": True, "collateral": bal, "reference": ref}


@router.post("/collateral/withdraw")
def withdraw_collateral(body: CollateralWithdrawIn, acct: Account = Depends(borrower_only),
                        session: Session = Depends(session_dep)) -> dict:
    available = collateral_balance(session, acct.id) - collateral_locked(session, acct.id)
    if body.amount > available + 1e-6:
        raise HTTPException(400, f"only {available} GBP is unlocked and withdrawable")
    session.add(FiatLedger(account_id=acct.id, entry_type="withdraw",
                           amount=-round(body.amount, 2), reference="collateral withdrawal"))
    session.commit()
    return {"ok": True, "collateral": collateral_balance(session, acct.id),
            "message": "Withdrawal successful."}


# --- quotes & loans ----------------------------------------------------------
@router.post("/quote", response_model=QuoteOut)
def request_quote(body: QuoteIn, acct: Account = Depends(borrower_only),
                  session: Session = Depends(session_dep)) -> QuoteOut:
    pool = rt.pool(body.pool_key)
    if not pool:
        raise HTTPException(404, "unknown pool")
    available = collateral_balance(session, acct.id) - collateral_locked(session, acct.id)
    limit = _credit_limit(available)
    q = risk_engine.quote_loan(
        pool=config.PoolConfig(pool.key, pool.name, pool.risk_tier,
                               pool.cover_rate_minimum, pool.base_apr),
        principal=body.amount,
        credit_score=acct.credit_score or 680,
        fiat_deposit=available,
        credit_limit=limit,
        term_hours=body.term_hours,
        pool_drawn=pool.drawn,
        pool_tvl=pool.tvl,
    )
    rq = rt.new_quote(account_id=acct.id, pool_key=pool.key, principal=q.principal,
                      interest_rate=q.interest_rate, term_hours=q.term_hours,
                      origination_fee=q.origination_fee, approved=q.approved, reason=q.reason)
    return QuoteOut(id=rq.id, pool_key=rq.pool_key, principal=rq.principal,
                    interest_rate=rq.interest_rate, term_hours=rq.term_hours,
                    origination_fee=rq.origination_fee, approved=rq.approved,
                    reason=rq.reason, seconds_left=rq.seconds_left, expires_at=rq.expires_at)


@router.post("/loans/accept")
def accept_quote(body: AcceptQuoteIn, acct: Account = Depends(borrower_only),
                 session: Session = Depends(session_dep)) -> dict:
    require_devnet_transactions("Loan origination")
    q = rt.quotes.get(body.quote_id)
    if not q or q.account_id != acct.id:
        raise HTTPException(404, "quote not found")
    if not q.live:
        raise HTTPException(410, "quote expired — request a fresh one")
    if not q.approved:
        raise HTTPException(400, q.reason or "quote not approved")
    if not acct.xrpl_address:
        raise HTTPException(400, "connect a wallet first")

    pool = rt.pools[q.pool_key]
    loan_id = ""
    try:
        rt.require_live_ready(pool_key=pool.key, need_broker=True)
    except RuntimeError as exc:
        raise HTTPException(503, f"Devnet live mode is not configured: {exc}") from exc
    from ..xrpl_service import assets
    from ..xrpl_service import loan as loan_svc
    from ..xrpl_service.client import get_client, wallet_from_seed
    client = get_client()
    res = loan_svc.originate_loan(
        wallet_from_seed(rt.operator_seed), wallet_from_seed(acct.xrpl_seed),
        pool.loan_broker_id, q.principal, q.interest_rate, q.term_hours, client)
    if not res.ok:
        raise HTTPException(502, f"LoanSet failed on Devnet: {res.engine_result}")
    tx_hash, loan_id = res.hash, (loan_svc.loan_id_from_result(res) or "")
    acct.wallet_rlusd_balance = assets.rlusd_balance(acct.xrpl_address, rt.issuer_address, client)

    # lock collateral, draw pool liquidity, book the loan + fee
    session.add(FiatLedger(account_id=acct.id, entry_type="lock",
                           amount=-q.principal, reference=f"loan {q.id}"))
    pool.drawn += q.principal
    rt.fees_collected += q.origination_fee
    loan = Loan(account_id=acct.id, pool_key=q.pool_key, principal=q.principal,
                interest_rate=q.interest_rate, term_hours=q.term_hours,
                origination_fee=q.origination_fee, status=LoanStatus.ACTIVE,
                xrpl_loan_id=loan_id, origination_tx=tx_hash,
                due_at=datetime.utcnow() + timedelta(hours=q.term_hours))
    session.add(loan)
    session.commit()
    session.refresh(loan)
    record_onchain_tx(
        session,
        account_id=acct.id,
        action="loan_origination",
        tx_hash=tx_hash,
        engine_result=res.engine_result,
        pool_key=q.pool_key,
        loan_id=loan.id,
        amount=q.principal,
    )
    del rt.quotes[q.id]
    return {"ok": True, "loan_id": loan.id, "tx_hash": tx_hash,
            "explorer_url": explorer_tx(tx_hash),
            "xrpl_loan_id": loan_id,
            "loan_explorer_url": explorer_object(loan_id),
            "wallet_balance": acct.wallet_rlusd_balance,
            "disbursed_to": acct.xrpl_address, "principal": q.principal}


@router.post("/loans/{loan_id}/repay")
def repay(loan_id: int, body: RepayIn, acct: Account = Depends(borrower_only),
          session: Session = Depends(session_dep)) -> dict:
    require_devnet_transactions("Loan repayment")
    loan = session.get(Loan, loan_id)
    if not loan or loan.account_id != acct.id:
        raise HTTPException(404, "loan not found")
    if loan.status != LoanStatus.ACTIVE:
        raise HTTPException(400, f"loan is {loan.status.value}")

    interest_due = round(loan.principal * loan.interest_rate * loan.term_hours / (365 * 24), 2)
    if body.mode == "interest":
        if not loan.xrpl_loan_id:
            raise HTTPException(400, "loan has no XRPL loan id; cannot repay on-chain")
        from ..xrpl_service import assets
        from ..xrpl_service import loan as loan_svc
        from ..xrpl_service.client import get_client, wallet_from_seed
        client = get_client()
        res = loan_svc.repay(
            wallet_from_seed(acct.xrpl_seed),
            loan.xrpl_loan_id,
            rt.issuer_address,
            interest_due,
            client,
        )
        if not res.ok:
            raise HTTPException(502, f"LoanPay failed on Devnet: {res.engine_result}")
        tx_hash = res.hash
        record_onchain_tx(
            session,
            account_id=acct.id,
            action="loan_pay_interest",
            tx_hash=tx_hash,
            engine_result=res.engine_result,
            pool_key=loan.pool_key,
            loan_id=loan.id,
            amount=interest_due,
        )
        acct.wallet_rlusd_balance = assets.rlusd_balance(acct.xrpl_address, rt.issuer_address, client)
        loan.interest_paid += interest_due
        rt.fees_collected += round(interest_due * config.MANAGEMENT_FEE, 2)
        session.add(loan)
        session.commit()
        return {"ok": True, "mode": "interest", "interest_paid": interest_due,
                "outstanding": loan.principal, "tx_hash": tx_hash,
                "explorer_url": explorer_tx(tx_hash),
                "wallet_balance": acct.wallet_rlusd_balance}

    if body.mode == "full":
        elapsed = (datetime.utcnow() - loan.created_at).total_seconds() / 3600
        min_hold = loan.term_hours * MIN_TERM_FRACTION
        if elapsed < min_hold:
            raise HTTPException(
                400,
                f"Minimum term not met: this loan must be held at least "
                f"{min_hold:.1f}h before full repayment (held {elapsed:.1f}h). "
                f"Pay interest only, or wait.")
        repay_total = round(loan.principal + interest_due, 2)
        if not loan.xrpl_loan_id:
            raise HTTPException(400, "loan has no XRPL loan id; cannot repay on-chain")
        from ..xrpl_service import assets
        from ..xrpl_service import loan as loan_svc
        from ..xrpl_service.client import get_client, wallet_from_seed
        client = get_client()
        res = loan_svc.repay_full(
            wallet_from_seed(acct.xrpl_seed),
            loan.xrpl_loan_id,
            rt.issuer_address,
            client,
        )
        if not res.ok:
            raise HTTPException(502, f"LoanPay full failed on Devnet: {res.engine_result}")
        tx_hash = res.hash
        record_onchain_tx(
            session,
            account_id=acct.id,
            action="loan_pay_full",
            tx_hash=tx_hash,
            engine_result=res.engine_result,
            pool_key=loan.pool_key,
            loan_id=loan.id,
            amount=repay_total,
        )
        acct.wallet_rlusd_balance = assets.rlusd_balance(acct.xrpl_address, rt.issuer_address, client)
        loan.interest_paid += interest_due
        loan.status = LoanStatus.REPAID
        rt.pools[loan.pool_key].drawn = max(0.0, rt.pools[loan.pool_key].drawn - loan.principal)
        rt.fees_collected += round(interest_due * config.MANAGEMENT_FEE, 2)
        # release locked collateral
        session.add(FiatLedger(account_id=acct.id, entry_type="release",
                               amount=loan.principal, reference=f"loan {loan.id} repaid"))
        session.add(loan)
        session.commit()
        return {"ok": True, "mode": "full", "interest_paid": loan.interest_paid,
                "principal_repaid": loan.principal, "status": "repaid",
                "tx_hash": tx_hash, "explorer_url": explorer_tx(tx_hash),
                "wallet_balance": acct.wallet_rlusd_balance}

    raise HTTPException(400, "mode must be 'interest' or 'full'")


@router.post("/loans/{loan_id}/default")
def default_loan(loan_id: int, acct: Account = Depends(borrower_only),
                 session: Session = Depends(session_dep)) -> dict:
    """Borrower defaults: forfeit collateral + a default charge, clearly billed."""
    require_devnet_transactions("Loan default")
    loan = session.get(Loan, loan_id)
    if not loan or loan.account_id != acct.id:
        raise HTTPException(404, "loan not found")
    if loan.status != LoanStatus.ACTIVE:
        raise HTTPException(400, f"loan is {loan.status.value}")
    default_charge = round(loan.principal * 0.05 + config.FIXED_SERVICE_FEE, 2)
    if not loan.xrpl_loan_id:
        raise HTTPException(400, "loan has no XRPL loan id; cannot default on-chain")
    from ..xrpl_service import loan as loan_svc
    from ..xrpl_service.client import get_client, wallet_from_seed
    client = get_client()
    res = loan_svc.default_loan(wallet_from_seed(rt.operator_seed), loan.xrpl_loan_id, client)
    if not res.ok:
        raise HTTPException(
            409,
            "XRPL did not accept default yet. The loan generally must be past "
            f"due/grace before LoanManage default is valid: {res.engine_result}",
        )
    tx_hash = res.hash
    record_onchain_tx(
        session,
        account_id=acct.id,
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
    # seize collateral: principal + charge consumed from the fiat deposit
    session.add(FiatLedger(account_id=acct.id, entry_type="default_charge",
                           amount=-(loan.principal + default_charge),
                           reference=f"loan {loan.id} default"))
    session.add(loan)
    session.commit()
    return {"ok": True, "status": "defaulted", "default_charge": default_charge,
            "collateral_seized": round(loan.principal + default_charge, 2),
            "tx_hash": tx_hash, "explorer_url": explorer_tx(tx_hash)}


# --- dashboard ---------------------------------------------------------------
@router.get("/me/dashboard", response_model=BorrowerDashboardOut)
def dashboard(acct: Account = Depends(borrower_only),
              session: Session = Depends(session_dep)) -> BorrowerDashboardOut:
    collateral = collateral_balance(session, acct.id)
    locked = collateral_locked(session, acct.id)
    loans = session.exec(select(Loan).where(Loan.account_id == acct.id)).all()
    total_borrowed = sum(l.principal for l in loans if l.status in
                         (LoanStatus.ACTIVE, LoanStatus.REPAID, LoanStatus.DEFAULTED))
    interest_paid = sum(l.interest_paid for l in loans)
    outstanding = sum(l.principal for l in loans if l.status == LoanStatus.ACTIVE)
    default_charges = sum(l.default_charge for l in loans)
    loan_rows = [{
        "id": l.id, "pool_key": l.pool_key, "principal": l.principal,
        "interest_rate": l.interest_rate, "term_hours": l.term_hours,
        "interest_paid": round(l.interest_paid, 2), "status": l.status.value,
        "default_charge": l.default_charge,
        "xrpl_loan_id": l.xrpl_loan_id,
        "loan_explorer_url": explorer_object(l.xrpl_loan_id),
        "origination_tx": l.origination_tx,
        "origination_explorer_url": explorer_tx(l.origination_tx),
        "due_at": l.due_at.isoformat() if l.due_at else None,
    } for l in loans]
    bill = {
        "interest_paid": round(interest_paid, 2),
        "origination_fees": round(sum(l.origination_fee for l in loans), 2),
        "default_charges": round(default_charges, 2),
        "total_owed_now": round(outstanding, 2),
    }
    return BorrowerDashboardOut(
        account=account_out(acct),
        collateral=collateral,
        collateral_locked=locked,
        collateral_available=round(collateral - locked, 2),
        total_borrowed=round(total_borrowed, 2),
        interest_paid=round(interest_paid, 2),
        outstanding=round(outstanding, 2),
        eligible_pools=_eligible_pools(session, acct),
        loans=loan_rows,
        bill=bill,
    )
