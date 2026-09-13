"""initial schema: lenders borrowers pools partners transactions

Revision ID: 001_initial
Revises:
Create Date: 2026-09-12
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lenders",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("company_name", sa.String(length=255), nullable=False),
        sa.Column("company_number", sa.String(length=64), nullable=True),
        sa.Column("contact_name", sa.String(length=255), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("lender_tier", sa.String(length=32), nullable=False),
        sa.Column("kyc_status", sa.String(length=32), nullable=False),
        sa.Column("xrpl_address", sa.String(length=128), nullable=True),
        sa.Column("wallet_provider", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_lenders_email", "lenders", ["email"], unique=True)

    op.create_table(
        "borrowers",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("company_name", sa.String(length=255), nullable=False),
        sa.Column("company_number", sa.String(length=64), nullable=True),
        sa.Column("contact_name", sa.String(length=255), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("kyc_status", sa.String(length=32), nullable=False),
        sa.Column("credit_status", sa.String(length=32), nullable=False),
        sa.Column("credit_score", sa.Integer(), nullable=True),
        sa.Column("collateral_balance", sa.Float(), nullable=False),
        sa.Column("xrpl_address", sa.String(length=128), nullable=True),
        sa.Column("wallet_provider", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_borrowers_email", "borrowers", ["email"], unique=True)

    op.create_table(
        "pools",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("key", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("risk_tier", sa.String(length=32), nullable=False),
        sa.Column("base_apr", sa.Float(), nullable=False),
        sa.Column("first_loss_pct", sa.Float(), nullable=False),
        sa.Column("capacity", sa.Float(), nullable=False),
        sa.Column("available_liquidity", sa.Float(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_pools_key", "pools", ["key"], unique=True)

    op.create_table(
        "partners",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("org_id", sa.String(length=64), nullable=False),
        sa.Column("company_name", sa.String(length=255), nullable=False),
        sa.Column("contact_name", sa.String(length=255), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("api_key", sa.String(length=128), nullable=True),
        sa.Column("api_secret_hash", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("api_key"),
    )
    op.create_index("ix_partners_org_id", "partners", ["org_id"], unique=True)
    op.create_index("ix_partners_email", "partners", ["email"], unique=True)

    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("tx_hash", sa.String(length=128), nullable=True),
        sa.Column("explorer_url", sa.String(length=512), nullable=True),
        sa.Column("memo", sa.Text(), nullable=True),
        sa.Column("lender_id", sa.Integer(), nullable=True),
        sa.Column("borrower_id", sa.Integer(), nullable=True),
        sa.Column("pool_id", sa.Integer(), nullable=True),
        sa.Column("partner_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["borrower_id"], ["borrowers.id"]),
        sa.ForeignKeyConstraint(["lender_id"], ["lenders.id"]),
        sa.ForeignKeyConstraint(["partner_id"], ["partners.id"]),
        sa.ForeignKeyConstraint(["pool_id"], ["pools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transactions_action", "transactions", ["action"], unique=False)
    op.create_index("ix_transactions_tx_hash", "transactions", ["tx_hash"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_transactions_tx_hash", table_name="transactions")
    op.drop_index("ix_transactions_action", table_name="transactions")
    op.drop_table("transactions")
    op.drop_index("ix_partners_email", table_name="partners")
    op.drop_index("ix_partners_org_id", table_name="partners")
    op.drop_table("partners")
    op.drop_index("ix_pools_key", table_name="pools")
    op.drop_table("pools")
    op.drop_index("ix_borrowers_email", table_name="borrowers")
    op.drop_table("borrowers")
    op.drop_index("ix_lenders_email", table_name="lenders")
    op.drop_table("lenders")
