"""Auth + onboarding: signup, simulated KYC / credit check, login, wallet connect.

Signup is shared by lenders and borrowers; the only difference is that lenders
don't need the credit check (it's marked NOT_REQUIRED). The KYC and credit-check
buttons in the UI hit the /verify endpoints here, which simulate a round-trip to
an external provider and flip the stored status from pending (orange) to passed
(green).
"""
from __future__ import annotations

import random
import hashlib
import secrets

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
    record_onchain_tx,
    require_devnet_transactions,
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
    _normalise_demo_wallet(acct, session)
    return TokenOut(token=issue_token(acct.id, session), account=account_out(acct))


@router.post("/verify/kyc", response_model=AccountOut)
def verify_kyc(acct: Account = Depends(current_account), session: Session = Depends(session_dep)):
    """Simulate the external KYC provider returning a pass (orange -> green)."""
    acct.kyc_status = CheckStatus.PASSED
    session.add(acct)
    session.commit()
    session.refresh(acct)
    _ensure_live_borrower_credential(acct, session)
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
    require_devnet_transactions("Wallet connection")
    if acct.xrpl_address:
        _normalise_demo_wallet(acct, session)
        bal = _rlusd_balance(acct.xrpl_address)
        if LIVE_CHAIN:
            acct.wallet_rlusd_balance = bal
            session.add(acct)
            session.commit()
        return WalletOut(xrpl_address=acct.xrpl_address, provider=acct.wallet_provider or body.provider,
                         rlusd_balance=acct.wallet_rlusd_balance or bal,
                         explorer_url=explorer_account(acct.xrpl_address))

    if LIVE_CHAIN:
        try:
            rt.require_live_ready()
        except RuntimeError as exc:
            raise HTTPException(503, f"Devnet live mode is not configured: {exc}") from exc
        from ..xrpl_service import assets
        from ..xrpl_service.client import fund_wallet, get_client, wallet_from_seed
        client = get_client()
        w = fund_wallet(client)
        trust = assets.create_trustline(w, rt.issuer_address, client)
        if not trust.ok:
            raise HTTPException(502, f"TrustSet failed on Devnet: {trust.engine_result}")
        record_onchain_tx(
            session,
            account_id=acct.id,
            action="wallet_trustline",
            tx_hash=trust.hash,
            engine_result=trust.engine_result,
        )
        if acct.role == Role.LENDER:
            mint = assets.mint_rlusd(wallet_from_seed(rt.issuer_seed), w.address, "500000", client)
            if not mint.ok:
                raise HTTPException(502, f"RLUSD mint failed on Devnet: {mint.engine_result}")
            record_onchain_tx(
                session,
                account_id=acct.id,
                action="lender_wallet_funding",
                tx_hash=mint.hash,
                engine_result=mint.engine_result,
                amount=500000,
            )
        address, seed, balance = w.address, w.seed, _rlusd_balance(w.address)
    else:
        address = body.address.strip() or _demo_classic_address()
        if body.address and not _valid_classic_address(address):
            raise HTTPException(400, "enter a valid XRPL classic address starting with r")
        seed = "external-signer" if body.address else "sEd" + _rand_b58(26)
        balance = 500_000.0 if acct.role == Role.LENDER else 0.0
    set_wallet_connected(session, acct, provider=body.provider, address=address, seed=seed, balance=balance)
    session.commit()
    _ensure_live_borrower_credential(acct, session)
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


_XRPL_ALPHABET = "rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz"


def _b58encode(raw: bytes) -> str:
    n = int.from_bytes(raw, "big")
    out = ""
    while n:
        n, rem = divmod(n, 58)
        out = _XRPL_ALPHABET[rem] + out
    pad = 0
    for b in raw:
        if b == 0:
            pad += 1
        else:
            break
    return _XRPL_ALPHABET[0] * pad + out


def _b58decode(value: str) -> bytes:
    n = 0
    for ch in value:
        if ch not in _XRPL_ALPHABET:
            raise ValueError("invalid base58 character")
        n = n * 58 + _XRPL_ALPHABET.index(ch)
    raw = n.to_bytes((n.bit_length() + 7) // 8, "big")
    pad = len(value) - len(value.lstrip(_XRPL_ALPHABET[0]))
    return b"\x00" * pad + raw


def _checksum(payload: bytes) -> bytes:
    return hashlib.sha256(hashlib.sha256(payload).digest()).digest()[:4]


def _demo_classic_address() -> str:
    payload = b"\x00" + secrets.token_bytes(20)
    return _b58encode(payload + _checksum(payload))


def _valid_classic_address(address: str) -> bool:
    if not address.startswith("r"):
        return False
    try:
        raw = _b58decode(address)
    except ValueError:
        return False
    if len(raw) != 25:
        return False
    return raw[-4:] == _checksum(raw[:-4]) and raw[0] == 0


def _normalise_demo_wallet(acct: Account, session: Session) -> None:
    if LIVE_CHAIN or not acct.xrpl_address or _valid_classic_address(acct.xrpl_address):
        return
    acct.xrpl_address = _demo_classic_address()
    acct.xrpl_seed = "sEd" + _rand_b58(26)
    session.add(acct)
    session.commit()


def _ensure_live_borrower_credential(acct: Account, session: Session) -> None:
    if not LIVE_CHAIN or acct.role != Role.BORROWER:
        return
    if acct.kyc_status != CheckStatus.PASSED or not acct.xrpl_seed or acct.credential_id:
        return
    try:
        rt.require_live_ready()
    except RuntimeError:
        return
    from ..xrpl_service import identity
    from ..xrpl_service.client import get_client, wallet_from_seed
    client = get_client()
    operator = wallet_from_seed(rt.operator_seed)
    borrower = wallet_from_seed(acct.xrpl_seed)
    issue = identity.issue_borrower_credential(operator, borrower.address, client)
    if not issue.ok:
        return
    record_onchain_tx(
        session,
        account_id=acct.id,
        action="credential_issue",
        tx_hash=issue.hash,
        engine_result=issue.engine_result,
    )
    accept = identity.accept_borrower_credential(borrower, operator.address, client)
    if accept.ok:
        record_onchain_tx(
            session,
            account_id=acct.id,
            action="credential_accept",
            tx_hash=accept.hash,
            engine_result=accept.engine_result,
        )
        acct.credential_id = accept.hash
        session.add(acct)
        session.commit()


def _rlusd_balance(address: str) -> float:
    if not LIVE_CHAIN:
        return 0.0
    from ..xrpl_service import assets
    from ..xrpl_service.client import get_client
    return assets.rlusd_balance(address, rt.issuer_address, get_client())
