"""Demo password change is shared across lender / borrower / partner access."""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from backend.main import app


def _signup(client: TestClient) -> tuple[dict, dict]:
    email = f"pw-{uuid.uuid4().hex[:10]}@example.test"
    resp = client.post("/auth/signup", json={
        "role": "lender",
        "company_name": "Password Co",
        "email": email,
        "password": "old-password",
    })
    assert resp.status_code == 200, resp.text
    body = resp.json()
    return {"Authorization": "Bearer " + body["token"]}, body["account"]


def test_change_password_updates_shared_credential():
    with TestClient(app) as c:
        headers, acct = _signup(c)
        bad = c.post("/auth/password", json={
            "current_password": "wrong",
            "new_password": "new-password",
        }, headers=headers)
        assert bad.status_code == 401

        short = c.post("/auth/password", json={
            "current_password": "old-password",
            "new_password": "short",
        }, headers=headers)
        assert short.status_code == 400

        ok = c.post("/auth/password", json={
            "current_password": "old-password",
            "new_password": "new-password",
        }, headers=headers)
        assert ok.status_code == 200, ok.text
        assert ok.json()["id"] == acct["id"]

        old = c.post("/auth/login", json={"email": acct["email"], "password": "old-password"})
        assert old.status_code == 401
        fresh = c.post("/auth/login", json={"email": acct["email"], "password": "new-password"})
        assert fresh.status_code == 200
        assert fresh.json()["account"]["id"] == acct["id"]


def test_change_password_rejects_neon_linked_empty_hash():
    from backend.db import Account, get_session
    from backend.services import issue_token

    with TestClient(app) as c:
        _, acct = _signup(c)
        with get_session() as session:
            row = session.get(Account, acct["id"])
            row.password_hash = ""
            row.neon_user_id = "neon-demo"
            session.add(row)
            session.commit()
            token = issue_token(row.id, session)
        neon_headers = {"Authorization": "Bearer " + token}
        resp = c.post("/auth/password", json={
            "current_password": "anything",
            "new_password": "new-password",
        }, headers=neon_headers)
        assert resp.status_code == 400
        assert "neon" in resp.json()["detail"].lower()


def test_reset_password_updates_demo_credential_without_session():
    with TestClient(app) as c:
        _, acct = _signup(c)
        short = c.post("/auth/password/reset", json={
            "email": acct["email"],
            "new_password": "short",
        })
        assert short.status_code == 400

        missing = c.post("/auth/password/reset", json={
            "email": "missing@example.test",
            "new_password": "reset-password",
        })
        assert missing.status_code == 404

        ok = c.post("/auth/password/reset", json={
            "email": acct["email"],
            "new_password": "reset-password",
        })
        assert ok.status_code == 200, ok.text
        assert ok.json()["id"] == acct["id"]

        old = c.post("/auth/login", json={"email": acct["email"], "password": "old-password"})
        assert old.status_code == 401
        fresh = c.post("/auth/login", json={"email": acct["email"], "password": "reset-password"})
        assert fresh.status_code == 200
        assert fresh.json()["account"]["id"] == acct["id"]


def test_reset_password_rejects_neon_linked_empty_hash():
    from backend.db import Account, get_session

    with TestClient(app) as c:
        _, acct = _signup(c)
        with get_session() as session:
            row = session.get(Account, acct["id"])
            row.password_hash = ""
            row.neon_user_id = "neon-demo"
            session.add(row)
            session.commit()
        resp = c.post("/auth/password/reset", json={
            "email": acct["email"],
            "new_password": "reset-password",
        })
        assert resp.status_code == 404
