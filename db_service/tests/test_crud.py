"""Unit tests for SQLAlchemy models + CRUD helpers."""
from __future__ import annotations

import pytest
from sqlalchemy.exc import IntegrityError

from db_service import crud, models, schemas


def test_create_and_get_lender(db):
    row = crud.create_row(
        db,
        models.Lender,
        schemas.LenderCreate(
            company_name="Aqua Capital",
            email="lend@example.com",
            password_hash="hash",
            lender_tier="professional",
        ),
    )
    assert row.id is not None
    assert row.email == "lend@example.com"
    assert row.lender_tier == "professional"
    fetched = crud.get_row(db, models.Lender, row.id)
    assert fetched is not None
    assert fetched.company_name == "Aqua Capital"


def test_lender_email_unique(db):
    payload = schemas.LenderCreate(
        company_name="A",
        email="dup@example.com",
        password_hash="x",
    )
    crud.create_row(db, models.Lender, payload)
    with pytest.raises(IntegrityError):
        crud.create_row(db, models.Lender, payload)
    db.rollback()


def test_update_borrower_collateral(db):
    row = crud.create_row(
        db,
        models.Borrower,
        schemas.BorrowerCreate(
            company_name="Trade Co",
            email="borrow@example.com",
            password_hash="hash",
            collateral_balance=1000,
        ),
    )
    updated = crud.update_row(
        db,
        row,
        schemas.BorrowerUpdate(collateral_balance=2500.5, credit_status="passed", credit_score=720),
    )
    assert updated.collateral_balance == 2500.5
    assert updated.credit_score == 720
    assert updated.credit_status == "passed"


def test_pool_and_partner_create(db):
    pool = crud.create_row(
        db,
        models.Pool,
        schemas.PoolCreate(key="low", name="Conservative", risk_tier="low", base_apr=0.04, capacity=1e6),
    )
    partner = crud.create_row(
        db,
        models.Partner,
        schemas.PartnerCreate(
            org_id="demo-org",
            company_name="Partner Ltd",
            email="partner@example.com",
            password_hash="hash",
            api_key="cf_test_key",
        ),
    )
    assert pool.key == "low"
    assert partner.org_id == "demo-org"
    assert partner.api_key == "cf_test_key"


def test_transaction_links_entities(db):
    lender = crud.create_row(
        db,
        models.Lender,
        schemas.LenderCreate(company_name="L", email="l2@example.com", password_hash="h"),
    )
    borrower = crud.create_row(
        db,
        models.Borrower,
        schemas.BorrowerCreate(company_name="B", email="b2@example.com", password_hash="h"),
    )
    pool = crud.create_row(
        db,
        models.Pool,
        schemas.PoolCreate(key="med", name="Balanced", risk_tier="med"),
    )
    tx = crud.create_row(
        db,
        models.Transaction,
        schemas.TransactionCreate(
            action="deposit",
            amount=5000,
            lender_id=lender.id,
            borrower_id=borrower.id,
            pool_id=pool.id,
            status="confirmed",
            tx_hash="ABC123",
        ),
    )
    assert tx.lender_id == lender.id
    assert tx.pool_id == pool.id
    assert tx.amount == 5000


def test_list_and_delete(db):
    for i in range(3):
        crud.create_row(
            db,
            models.Pool,
            schemas.PoolCreate(key=f"p{i}", name=f"Pool {i}", risk_tier="low"),
        )
    rows = crud.list_rows(db, models.Pool, limit=2, offset=0)
    assert len(rows) == 2
    crud.delete_row(db, rows[0])
    assert crud.get_row(db, models.Pool, rows[0].id) is None
