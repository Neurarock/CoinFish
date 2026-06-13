"""Auth + onboarding: signup, simulated KYC / credit check, login, wallet connect.

Signup is shared by lenders and borrowers; the only difference is that lenders
don't need the credit check (it's marked NOT_REQUIRED). The KYC and credit-check
buttons in the UI hit the /verify endpoints here, which simulate a round-trip to
an external provider and flip the stored status from pending (orange) to passed
(green).
"""
from __future__ import annotations

import random

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlmodel import Session, select

from .. import db
from ..db import Account, CheckStatus, Role
from ..runtime import LIVE_CHAIN, rt
from ..schemas import AccountOut, LoginIn, SignupIn, TokenOut, WalletConnectIn, WalletOut
from ..services import (
    account_out,
    current_account,
    explorer_account,
    hash_password,
    issue_token,
    session_dep,
    set_wallet_connected,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenOut)
def signup(body: SignupIn, session: Session = Depends(session_dep)) -> TokenOut:
    if body.role not in ("lender", "borrower"):
        raise HTTPException(400, "role must be 'lender' or 'borrower'")
    existing = session.exec(select(Account).where(Account.email == body.email)).first()
    if existing:
        raise HTTPException(409, "email already registered")
    role = Role(body.role)
    acct = Account(
        role=role,
        company_name=body.company_name,
        email=body.email,
        password_hash=hash_password(body.password),
        kyc_status=CheckStatus.PENDING,
        # lenders skip the credit check entirely
        credit_status=CheckStatus.NOT_REQUIRED if role == Role.LENDER else CheckStatus.PENDING,
    )
    session.add(acct)
    session.commit()
    session.refresh(acct)
    return TokenOut(token=issue_token(acct.id, session), account=account_out(acct))


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, session: Session = Depends(session_dep)) -> TokenOut:
    acct = session.exec(select(Account).where(Account.email == body.email)).first()
    if not acct or not verify_password(body.password, acct.password_hash):
        raise HTTPException(401, "invalid credentials")
    return TokenOut(token=issue_token(acct.id, session), account=account_out(acct))


@router.post("/verify/kyc", response_model=AccountOut)
def verify_kyc(acct: Account = Depends(current_account), session: Session = Depends(session_dep)):
    """Simulate the external KYC provider returning a pass (orange -> green)."""
    acct.kyc_status = CheckStatus.PASSED
    session.add(acct)
    session.commit()
    session.refresh(acct)
    return account_out(acct)


@router.post("/verify/credit", response_model=AccountOut)
def verify_credit(acct: Account = Depends(current_account), session: Session = Depends(session_dep)):
    """Simulate an external credit bureau (borrowers only)."""
    if acct.role == Role.LENDER:
        raise HTTPException(400, "lenders do not require a credit check")
    acct.credit_status = CheckStatus.PASSED
    acct.credit_score = random.randint(640, 820)  # demo score feeds the rate engine
    session.add(acct)
    session.commit()
    session.refresh(acct)
    return account_out(acct)


@router.post("/wallet/connect", response_model=WalletOut)
def connect_wallet(
    body: WalletConnectIn | None = Body(default=None),
    acct: Account = Depends(current_account),
    session: Session = Depends(session_dep),
):
    """Connect a wallet-style signer for the account.

    In production this would be a Xaman/Crossmark/GemWallet sign-in and later
    sign request. In demo mode we record the chosen provider, address and RLUSD
    balance in SQLite so refresh/login keeps the same wallet.
    """
    body = body or WalletConnectIn()
    if acct.xrpl_address:
        bal = _rlusd_balance(acct.xrpl_address)
        if LIVE_CHAIN:
            acct.wallet_rlusd_balance = bal
            session.add(acct)
            session.commit()
        return WalletOut(xrpl_address=acct.xrpl_address, provider=acct.wallet_provider or body.provider,
                         rlusd_balance=acct.wallet_rlusd_balance or bal,
                         explorer_url=explorer_account(acct.xrpl_address))

    if LIVE_CHAIN:
        from ..xrpl_service import assets
        from ..xrpl_service.client import fund_wallet, get_client
        client = get_client()
        w = fund_wallet(client)
        assets.create_trustline(w, rt.issuer_address, client)
        address, seed, balance = w.address, w.seed, _rlusd_balance(w.address)
    else:
        address = body.address.strip() or ("r" + _rand_b58(33))
        seed = "external-signer" if body.address else "sEd" + _rand_b58(26)
        balance = 500_000.0 if acct.role == Role.LENDER else 0.0
    set_wallet_connected(session, acct, provider=body.provider, address=address, seed=seed, balance=balance)
    session.commit()
    return WalletOut(xrpl_address=acct.xrpl_address, provider=acct.wallet_provider,
                     rlusd_balance=acct.wallet_rlusd_balance,
                     explorer_url=explorer_account(acct.xrpl_address))


@router.get("/me", response_model=AccountOut)
def me(acct: Account = Depends(current_account)) -> AccountOut:
    return account_out(acct)


# --- helpers -----------------------------------------------------------------
def _rand_b58(n: int) -> str:
    alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    return "".join(random.choice(alphabet) for _ in range(n))


def _rlusd_balance(address: str) -> float:
    if not LIVE_CHAIN:
        return 0.0
    from ..xrpl_service import assets
    from ..xrpl_service.client import get_client
    return assets.rlusd_balance(address, rt.issuer_address, get_client())
