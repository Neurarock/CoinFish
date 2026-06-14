"""Lender flow: deposit into a pool, view yield dashboard, withdraw (exit queue).

Deposits move RLUSD into a pool's vault (VaultDeposit) and mint vault shares.
Withdrawals go through the exit queue: they fill immediately against idle
liquidity, or — if the pool is mostly lent out — partially fill and park the rest
in a fair FIFO queue that drains as loans repay. See exit_queue.py for the logic.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from .. import config
from ..db import Account, Deposit, ExitRow, Role
from ..runtime import rt
from ..schemas import (
    DepositIn,
    LenderDashboardOut,
    WithdrawIn,
)
from ..services import account_out, require_role, session_dep
from ..services import (
    explorer_tx,
    record_onchain_tx,
    require_devnet_transactions,
)
from .pools import pool_out

router = APIRouter(prefix="/lenders", tags=["lenders"])
lender_only = require_role(Role.LENDER)

# annualised yield is accrued pro-rata to time held; demo uses a simple model
YIELD_FACTOR = 0.0


@router.post("/deposit")
def deposit(body: DepositIn, acct: Account = Depends(lender_only),
            session: Session = Depends(session_dep)) -> dict:
    require_devnet_transactions("Lender deposit")
    if not acct.xrpl_address:
        raise HTTPException(400, "connect a wallet first")
    pool = rt.pool(body.pool_key)
    if not pool:
        raise HTTPException(404, "unknown pool")
    if body.amount <= 0:
        raise HTTPException(400, "amount must be positive")
    # Per-pool access control: a lender may only deposit if their accreditation
    # tier meets the pool's minimum (riskier pools need sophisticated lenders).
    if not config.lender_can_access(acct.lender_tier or "retail", pool.key):
        raise HTTPException(
            403,
            f"{pool.name} is restricted to {config.pool_min_tier(pool.key)} "
            f"tier and above. Your accreditation is '{acct.lender_tier or 'retail'}'.",
        )
    from ..xrpl_service import assets, vault
    from ..xrpl_service.client import get_client, wallet_from_seed
    try:
        rt.require_live_ready(pool_key=pool.key)
    except RuntimeError as exc:
        raise HTTPException(503, f"Devnet live mode is not configured: {exc}") from exc
    client = get_client()
    res = vault.deposit(wallet_from_seed(acct.xrpl_seed), pool.vault_id,
                        rt.issuer_address, body.amount, client)
    if not res.ok:
        raise HTTPException(502, f"VaultDeposit failed on Devnet: {res.engine_result}")
    tx_hash = res.hash
    record_onchain_tx(
        session,
        account_id=acct.id,
        action="vault_deposit",
        tx_hash=tx_hash,
        engine_result=res.engine_result,
        pool_key=pool.key,
        amount=body.amount,
    )
    acct.wallet_rlusd_balance = assets.rlusd_balance(acct.xrpl_address, rt.issuer_address, client)

    pool.tvl += body.amount                       # shares ~ 1:1 in demo
    row = Deposit(account_id=acct.id, pool_key=pool.key, principal=body.amount,
                  shares=body.amount, deposit_tx=tx_hash)
    session.add(row)
    session.commit()
    return {"ok": True, "tx_hash": tx_hash, "explorer_url": explorer_tx(tx_hash),
            "wallet_balance": acct.wallet_rlusd_balance,
            "pool": pool_out(pool.key).model_dump()}


@router.post("/withdraw")
def withdraw(body: WithdrawIn, acct: Account = Depends(lender_only),
             session: Session = Depends(session_dep)) -> dict:
    require_devnet_transactions("Lender withdrawal")
    pool = rt.pool(body.pool_key)
    if not pool:
        raise HTTPException(404, "unknown pool")
    held = _held_principal(session, acct.id, pool.key)
    if body.amount > held + 1e-6:
        raise HTTPException(400, f"requested {body.amount} exceeds your position {held}")

    from ..xrpl_service import assets, vault
    from ..xrpl_service.client import get_client, wallet_from_seed
    try:
        rt.require_live_ready(pool_key=pool.key)
    except RuntimeError as exc:
        raise HTTPException(503, f"Devnet live mode is not configured: {exc}") from exc
    client = get_client()
    available, _total = vault.vault_liquidity(pool.vault_id, client)
    fill = min(body.amount, available)
    tx_hashes: list[str] = []
    if fill > 0:
        res = vault.withdraw(
            wallet_from_seed(acct.xrpl_seed),
            pool.vault_id,
            rt.issuer_address,
            fill,
            client,
        )
        if not res.ok:
            raise HTTPException(502, f"VaultWithdraw failed on Devnet: {res.engine_result}")
        tx_hashes.append(res.hash)
        record_onchain_tx(
            session,
            account_id=acct.id,
            action="vault_withdraw",
            tx_hash=res.hash,
            engine_result=res.engine_result,
            pool_key=pool.key,
            amount=fill,
        )
        pool.tvl = max(0.0, pool.tvl - fill)
        acct.wallet_rlusd_balance = assets.rlusd_balance(acct.xrpl_address, rt.issuer_address, client)
    remaining = round(body.amount - fill, 2)
    status = "filled" if remaining <= 1e-6 else "partial" if fill > 0 else "pending"
    row = ExitRow(account_id=acct.id, pool_key=pool.key,
                  amount_requested=body.amount,
                  amount_filled=round(fill, 2), status=status)
    session.add(acct)
    session.add(row)
    session.commit()
    queued = status != "filled"
    return {
        "ok": True,
        "status": status,
        "filled": round(fill, 2),
        "remaining": remaining,
        "queued": queued,
        "message": ("Withdrawal complete." if not queued else
                    "Vault liquidity is low — the remaining amount is queued "
                    "until loans repay or mature."),
        "tx_hashes": tx_hashes,
        "explorer_urls": [explorer_tx(h) for h in tx_hashes],
        "wallet_balance": acct.wallet_rlusd_balance,
    }


@router.get("/me/dashboard", response_model=LenderDashboardOut)
def dashboard(acct: Account = Depends(lender_only),
              session: Session = Depends(session_dep)) -> LenderDashboardOut:
    deposits = session.exec(select(Deposit).where(Deposit.account_id == acct.id)).all()
    positions = []
    total_dep = total_shares = accrued = 0.0
    by_pool: dict[str, float] = {}
    withdrawals = session.exec(select(ExitRow).where(ExitRow.account_id == acct.id)).all()
    withdrawn_by_pool: dict[str, float] = {}
    for w in withdrawals:
        withdrawn_by_pool[w.pool_key] = withdrawn_by_pool.get(w.pool_key, 0.0) + w.amount_filled
    for d in deposits:
        by_pool[d.pool_key] = by_pool.get(d.pool_key, 0.0) + d.principal
    for pool_key, deposited in list(by_pool.items()):
        principal = round(max(0.0, deposited - withdrawn_by_pool.get(pool_key, 0.0)), 2)
        if principal <= 0:
            by_pool.pop(pool_key, None)
            continue
        by_pool[pool_key] = principal
        total_dep += principal
        total_shares += principal
    for pool_key, principal in by_pool.items():
        pool = rt.pool(pool_key)
        if pool is None:                 # defensive: skip any stale/unknown pool key
            continue
        yield_est = round(principal * pool.base_apr * (1 - 0.03) / 365, 2)  # ~1 day accrual
        accrued += yield_est
        positions.append({
            **pool_out(pool_key).model_dump(),
            "your_principal": round(principal, 2),
            "your_yield": yield_est,
        })
    exit_q = [{"pool_key": e.pool_key, "amount_requested": e.amount_requested,
               "amount_filled": e.amount_filled, "status": e.status} for e in withdrawals]
    return LenderDashboardOut(
        account=account_out(acct),
        total_deposited=round(total_dep, 2),
        total_shares=round(total_shares, 2),
        accrued_yield=round(accrued, 2),
        positions=positions,
        exit_queue=exit_q,
    )


def _held_principal(session: Session, account_id: int, pool_key: str) -> float:
    deposits = session.exec(
        select(Deposit).where(Deposit.account_id == account_id, Deposit.pool_key == pool_key)
    ).all()
    withdrawn = session.exec(
        select(ExitRow).where(ExitRow.account_id == account_id, ExitRow.pool_key == pool_key)
    ).all()
    return round(sum(d.principal for d in deposits) - sum(w.amount_filled for w in withdrawn), 2)
