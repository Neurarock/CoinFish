"""Pydantic request/response schemas for the DB microservice."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Lender ------------------------------------------------------------------
class LenderCreate(BaseModel):
    company_name: str
    email: str
    password_hash: str
    company_number: Optional[str] = None
    contact_name: Optional[str] = None
    lender_tier: str = "retail"
    kyc_status: str = "pending"
    xrpl_address: Optional[str] = None
    wallet_provider: Optional[str] = None
    status: str = "active"


class LenderUpdate(BaseModel):
    company_name: Optional[str] = None
    company_number: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    password_hash: Optional[str] = None
    lender_tier: Optional[str] = None
    kyc_status: Optional[str] = None
    xrpl_address: Optional[str] = None
    wallet_provider: Optional[str] = None
    status: Optional[str] = None


class LenderRead(OrmModel):
    id: int
    company_name: str
    company_number: Optional[str]
    contact_name: Optional[str]
    email: str
    lender_tier: str
    kyc_status: str
    xrpl_address: Optional[str]
    wallet_provider: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime


# --- Borrower ----------------------------------------------------------------
class BorrowerCreate(BaseModel):
    company_name: str
    email: str
    password_hash: str
    company_number: Optional[str] = None
    contact_name: Optional[str] = None
    kyc_status: str = "pending"
    credit_status: str = "pending"
    credit_score: Optional[int] = None
    collateral_balance: float = 0.0
    xrpl_address: Optional[str] = None
    wallet_provider: Optional[str] = None
    status: str = "active"


class BorrowerUpdate(BaseModel):
    company_name: Optional[str] = None
    company_number: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    password_hash: Optional[str] = None
    kyc_status: Optional[str] = None
    credit_status: Optional[str] = None
    credit_score: Optional[int] = None
    collateral_balance: Optional[float] = None
    xrpl_address: Optional[str] = None
    wallet_provider: Optional[str] = None
    status: Optional[str] = None


class BorrowerRead(OrmModel):
    id: int
    company_name: str
    company_number: Optional[str]
    contact_name: Optional[str]
    email: str
    kyc_status: str
    credit_status: str
    credit_score: Optional[int]
    collateral_balance: float
    xrpl_address: Optional[str]
    wallet_provider: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime


# --- Pool --------------------------------------------------------------------
class PoolCreate(BaseModel):
    key: str = Field(min_length=1, max_length=32)
    name: str
    risk_tier: str
    base_apr: float = 0.0
    first_loss_pct: float = 0.0
    capacity: float = 0.0
    available_liquidity: float = 0.0
    status: str = "open"
    description: Optional[str] = None


class PoolUpdate(BaseModel):
    key: Optional[str] = None
    name: Optional[str] = None
    risk_tier: Optional[str] = None
    base_apr: Optional[float] = None
    first_loss_pct: Optional[float] = None
    capacity: Optional[float] = None
    available_liquidity: Optional[float] = None
    status: Optional[str] = None
    description: Optional[str] = None


class PoolRead(OrmModel):
    id: int
    key: str
    name: str
    risk_tier: str
    base_apr: float
    first_loss_pct: float
    capacity: float
    available_liquidity: float
    status: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime


# --- Partner -----------------------------------------------------------------
class PartnerCreate(BaseModel):
    org_id: str
    company_name: str
    email: str
    password_hash: str
    contact_name: Optional[str] = None
    api_key: Optional[str] = None
    api_secret_hash: Optional[str] = None
    status: str = "pending"
    notes: Optional[str] = None


class PartnerUpdate(BaseModel):
    org_id: Optional[str] = None
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    password_hash: Optional[str] = None
    api_key: Optional[str] = None
    api_secret_hash: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class PartnerRead(OrmModel):
    id: int
    org_id: str
    company_name: str
    contact_name: Optional[str]
    email: str
    api_key: Optional[str]
    status: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime


# --- Transaction -------------------------------------------------------------
class TransactionCreate(BaseModel):
    action: str
    amount: float = 0.0
    currency: str = "RLUSD"
    status: str = "pending"
    tx_hash: Optional[str] = None
    explorer_url: Optional[str] = None
    memo: Optional[str] = None
    lender_id: Optional[int] = None
    borrower_id: Optional[int] = None
    pool_id: Optional[int] = None
    partner_id: Optional[int] = None


class TransactionUpdate(BaseModel):
    action: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    status: Optional[str] = None
    tx_hash: Optional[str] = None
    explorer_url: Optional[str] = None
    memo: Optional[str] = None
    lender_id: Optional[int] = None
    borrower_id: Optional[int] = None
    pool_id: Optional[int] = None
    partner_id: Optional[int] = None


class TransactionRead(OrmModel):
    id: int
    action: str
    amount: float
    currency: str
    status: str
    tx_hash: Optional[str]
    explorer_url: Optional[str]
    memo: Optional[str]
    lender_id: Optional[int]
    borrower_id: Optional[int]
    pool_id: Optional[int]
    partner_id: Optional[int]
    created_at: datetime
    updated_at: datetime
