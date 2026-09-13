"""API-level CRUD tests for the DB microservice."""
from __future__ import annotations


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_lender_crud_flow(client):
    create = client.post(
        "/lenders",
        json={
            "company_name": "Lender Co",
            "email": "lender-api@example.com",
            "password_hash": "hashed",
            "lender_tier": "institutional",
        },
    )
    assert create.status_code == 201
    body = create.json()
    assert body["id"] > 0
    lender_id = body["id"]

    listed = client.get("/lenders")
    assert listed.status_code == 200
    assert any(x["id"] == lender_id for x in listed.json())

    got = client.get(f"/lenders/{lender_id}")
    assert got.status_code == 200
    assert got.json()["email"] == "lender-api@example.com"

    patched = client.patch(f"/lenders/{lender_id}", json={"kyc_status": "passed"})
    assert patched.status_code == 200
    assert patched.json()["kyc_status"] == "passed"

    deleted = client.delete(f"/lenders/{lender_id}")
    assert deleted.status_code == 204
    assert client.get(f"/lenders/{lender_id}").status_code == 404


def test_borrower_pool_partner_transaction_flow(client):
    borrower = client.post(
        "/borrowers",
        json={
            "company_name": "Borrow Co",
            "email": "borrow-api@example.com",
            "password_hash": "hashed",
            "collateral_balance": 10_000,
        },
    ).json()
    pool = client.post(
        "/pools",
        json={
            "key": "high",
            "name": "Growth",
            "risk_tier": "high",
            "base_apr": 0.12,
            "capacity": 2_000_000,
            "available_liquidity": 500_000,
        },
    ).json()
    partner = client.post(
        "/partners",
        json={
            "org_id": "acme",
            "company_name": "Acme Partners",
            "email": "acme@example.com",
            "password_hash": "hashed",
            "status": "active",
        },
    ).json()

    tx = client.post(
        "/transactions",
        json={
            "action": "borrow",
            "amount": 2500,
            "borrower_id": borrower["id"],
            "pool_id": pool["id"],
            "partner_id": partner["id"],
            "status": "pending",
        },
    )
    assert tx.status_code == 201
    tx_body = tx.json()
    assert tx_body["borrower_id"] == borrower["id"]
    assert tx_body["pool_id"] == pool["id"]

    updated = client.patch(
        f"/transactions/{tx_body['id']}",
        json={"status": "confirmed", "tx_hash": "DEADBEEF"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "confirmed"
    assert updated.json()["tx_hash"] == "DEADBEEF"


def test_not_found_and_pagination(client):
    # recreate clean 404 delete check
    missing = client.delete("/lenders/424242")
    assert missing.status_code == 404

    for i in range(5):
        client.post(
            "/pools",
            json={"key": f"page{i}", "name": f"P{i}", "risk_tier": "low"},
        )
    page = client.get("/pools", params={"limit": 2, "offset": 2})
    assert page.status_code == 200
    assert len(page.json()) == 2
