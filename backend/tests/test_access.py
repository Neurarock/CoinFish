"""One company account can hold several kinds of access; extra access is opt-in."""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from backend.db import Account, CheckStatus, get_session
from backend.main import app


def _signup(client: TestClient, role: str) -> tuple[dict, dict]:
    email = f"{role}-{uuid.uuid4().hex[:10]}@example.test"
    resp = client.post("/auth/signup", json={
        "role": role,
        "company_name": f"Test {role.title()}",
        "email": email,
        "password": "demo-pass",
        "lender_tier": "institutional",
    })
    assert resp.status_code == 200, resp.text
    body = resp.json()
    return {"Authorization": "Bearer " + body["token"]}, body["account"]


def _ready_for_access(account_id: int, *, credit: bool = False) -> None:
    with get_session() as session:
        acct = session.get(Account, account_id)
        acct.kyc_status = CheckStatus.PASSED
        acct.xrpl_address = "rNavCheckWalletXXXXXXXXXXXXXXX"
        if credit:
            acct.credit_status = CheckStatus.PASSED
            acct.credit_score = 710
        session.add(acct)
        session.commit()


def test_signup_same_email_resumes_account_without_new_access():
    with TestClient(app) as c:
        headers, acct = _signup(c, "lender")
        again = c.post("/auth/signup", json={
            "role": "borrower",
            "company_name": "Should Not Split",
            "email": acct["email"],
            "password": "demo-pass",
        })
        assert again.status_code == 200, again.text
        body = again.json()["account"]
        assert body["id"] == acct["id"]
        assert body["can_lend"] is True
        assert body["can_borrow"] is False
        assert body["role"] == "lender"


def test_signup_same_email_wrong_password_is_conflict():
    with TestClient(app) as c:
        _, acct = _signup(c, "lender")
        resp = c.post("/auth/signup", json={
            "role": "borrower",
            "company_name": "Nope",
            "email": acct["email"],
            "password": "wrong-pass",
        })
        assert resp.status_code == 409
        assert "log in" in resp.json()["detail"].lower()


def test_login_does_not_switch_requested_role():
    with TestClient(app) as c:
        _, acct = _signup(c, "lender")
        resp = c.post("/auth/login", json={"email": acct["email"], "password": "demo-pass"})
        assert resp.status_code == 200
        body = resp.json()["account"]
        assert body["role"] == "lender"
        assert body["can_lend"] is True
        assert body["can_borrow"] is False


def test_enable_borrower_access_after_credit():
    with TestClient(app) as c:
        headers, acct = _signup(c, "lender")
        blocked = c.post("/auth/access", json={"role": "borrower"}, headers=headers)
        assert blocked.status_code == 400
        _ready_for_access(acct["id"], credit=True)
        ok = c.post("/auth/access", json={"role": "borrower"}, headers=headers)
        assert ok.status_code == 200, ok.text
        body = ok.json()
        assert body["can_lend"] is True
        assert body["can_borrow"] is True
        assert body["id"] == acct["id"]
        lend = c.get("/lenders/me/dashboard", headers=headers)
        borrow = c.get("/borrowers/me/dashboard", headers=headers)
        assert lend.status_code == 200, lend.text
        assert borrow.status_code == 200, borrow.text


def test_enable_borrower_without_credit_is_rejected():
    with TestClient(app) as c:
        headers, acct = _signup(c, "lender")
        _ready_for_access(acct["id"], credit=False)
        resp = c.post("/auth/access", json={"role": "borrower"}, headers=headers)
        assert resp.status_code == 400
        assert "credit" in resp.json()["detail"].lower()


def test_borrower_cannot_hit_lender_routes_until_enabled():
    with TestClient(app) as c:
        headers, _ = _signup(c, "borrower")
        resp = c.post("/lenders/deposit", json={"pool_key": "low", "amount": 100}, headers=headers)
        assert resp.status_code == 403
        assert "lender" in resp.json()["detail"].lower()
