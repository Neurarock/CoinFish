"""Request/response models for the CoinFish API (Pydantic)."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


# --- auth --------------------------------------------------------------------
class SignupIn(BaseModel):
    role: str                      # "lender" | "borrower"
    company_name: str
    email: str
    password: str
    contact_name: str = ""
    company_number: str = ""       # e.g. Companies House number (cosmetic for demo)


class LoginIn(BaseModel):
    email: str
    password: str


class AccountOut(BaseModel):
    id: int
    role: str
    company_name: str
    email: str
    kyc_status: str
    credit_status: str
    credit_score: int
    xrpl_address: str
    wallet_provider: str = ""
    wallet_rlusd_balance: float = 0.0
    wallet_explorer_url: str = ""
    wallet_connected: bool


class TokenOut(BaseModel):
    token: str
    account: AccountOut


# --- wallet ------------------------------------------------------------------
class WalletOut(BaseModel):
    xrpl_address: str
    provider: str
    rlusd_balance: float
    explorer_url: str


class WalletConnectIn(BaseModel):
    provider: str = "devnet"
    address: str = ""


# --- lender ------------------------------------------------------------------
class DepositIn(BaseModel):
    pool_key: str
    amount: float


class WithdrawIn(BaseModel):
    pool_key: str
    amount: float


class PoolOut(BaseModel):
    key: str
    name: str
    risk_tier: str
    base_apr: float
    net_apr: float                 # base APR net of management fee
    first_loss_buffer: float       # cover_rate_minimum
    tvl: float
    available: float
    drawn: float
    utilisation: float             # 0..1, drives the water-level animation
    first_loss_capital: float


class LenderDashboardOut(BaseModel):
    account: AccountOut
    total_deposited: float
    total_shares: float
    accrued_yield: float
    positions: list[dict]
    exit_queue: list[dict]


# --- borrower ----------------------------------------------------------------
class CollateralTopupIn(BaseModel):
    amount: float                  # GBP


class CollateralWithdrawIn(BaseModel):
    amount: float


class BankTransferOut(BaseModel):
    """Simulated UK bank-transfer instructions + QR payload for a fiat top-up."""
    amount: float
    account_name: str
    sort_code: str
    account_number: str
    reference: str
    qr_payload: str                # string the frontend renders as a QR code


class QuoteIn(BaseModel):
    pool_key: str
    amount: float
    term_hours: int


class QuoteOut(BaseModel):
    id: str
    pool_key: str
    principal: float
    interest_rate: float
    term_hours: int
    origination_fee: float
    approved: bool
    reason: str
    seconds_left: float
    expires_at: float


class AcceptQuoteIn(BaseModel):
    quote_id: str


class RepayIn(BaseModel):
    mode: str                      # "interest" | "full"


class BorrowerDashboardOut(BaseModel):
    account: AccountOut
    collateral: float
    collateral_locked: float
    collateral_available: float
    total_borrowed: float
    interest_paid: float
    outstanding: float
    eligible_pools: list[dict]
    loans: list[dict]
    bill: dict


# --- admin / CoinFish vault --------------------------------------------------
class GraceExtendIn(BaseModel):
    loan_id: int
    hours: int


class AdminDashboardOut(BaseModel):
    fees_collected: float
    total_tvl: float
    total_drawn: float
    total_first_loss: float
    underwater: bool               # liabilities > assets -> UI "underwater" effect
    solvency_ratio: float
    risk_score: float              # 0..100
    risk_band: str
    pools: list[dict]
    at_risk_loans: list[dict]      # loans inside the grace window (critical section)
