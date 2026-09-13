"""SQLAlchemy table definitions for the CoinFish Postgres microservice.

Tables: lenders, borrowers, pools, transactions, partners.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Lender(Base):
    __tablename__ = "lenders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_number: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    contact_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    lender_tier: Mapped[str] = mapped_column(String(32), default="retail", nullable=False)
    kyc_status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    xrpl_address: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    wallet_provider: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    transactions: Mapped[list[Transaction]] = relationship(back_populates="lender")


class Borrower(Base):
    __tablename__ = "borrowers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_number: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    contact_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    kyc_status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    credit_status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    credit_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    collateral_balance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    xrpl_address: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    wallet_provider: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    transactions: Mapped[list[Transaction]] = relationship(back_populates="borrower")


class Pool(Base):
    __tablename__ = "pools"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    risk_tier: Mapped[str] = mapped_column(String(32), nullable=False)
    base_apr: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    first_loss_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    capacity: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    available_liquidity: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    status: Mapped[str] = mapped_column(String(32), default="open", nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    transactions: Mapped[list[Transaction]] = relationship(back_populates="pool")


class Partner(Base):
    __tablename__ = "partners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    api_key: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True)
    api_secret_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    transactions: Mapped[list[Transaction]] = relationship(back_populates="partner")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    currency: Mapped[str] = mapped_column(String(16), nullable=False, default="RLUSD")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    tx_hash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    explorer_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    memo: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    lender_id: Mapped[Optional[int]] = mapped_column(ForeignKey("lenders.id"), nullable=True)
    borrower_id: Mapped[Optional[int]] = mapped_column(ForeignKey("borrowers.id"), nullable=True)
    pool_id: Mapped[Optional[int]] = mapped_column(ForeignKey("pools.id"), nullable=True)
    partner_id: Mapped[Optional[int]] = mapped_column(ForeignKey("partners.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    lender: Mapped[Optional[Lender]] = relationship(back_populates="transactions")
    borrower: Mapped[Optional[Borrower]] = relationship(back_populates="transactions")
    pool: Mapped[Optional[Pool]] = relationship(back_populates="transactions")
    partner: Mapped[Optional[Partner]] = relationship(back_populates="transactions")
