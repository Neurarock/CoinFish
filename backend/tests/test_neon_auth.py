"""Neon Managed Better Auth claim mapping and session exchange."""
from __future__ import annotations

import os

os.environ["COINFISH_DB_URL"] = "sqlite:////tmp/coinfish-test-neon-auth.db"

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.neon_auth import NeonIdentity, identity_from_claims, verify_neon_token


def test_identity_from_claims_normalises_email():
    ident = identity_from_claims({
        "id": "user-1",
        "email": "Ops@Example.TEST",
        "emailVerified": True,
        "name": "Jonathan",
    })
    assert ident == NeonIdentity(
        user_id="user-1",
        email="ops@example.test",
        email_verified=True,
        name="Jonathan",
    )


def test_identity_from_claims_accepts_sub_and_snake_case_verified():
    ident = identity_from_claims({
        "sub": "user-2",
        "email": "a@b.test",
        "email_verified": True,
    })
    assert ident.user_id == "user-2"
    assert ident.email_verified is True


def test_identity_from_claims_requires_email():
    with pytest.raises(HTTPException) as exc:
        identity_from_claims({"sub": "user-3"})
    assert exc.value.status_code == 401


def test_verify_neon_token_requires_config(monkeypatch):
    monkeypatch.setattr("backend.neon_auth.base_url", lambda: "")
    with pytest.raises(HTTPException) as exc:
        verify_neon_token("header.payload.sig")
    assert exc.value.status_code == 503


def test_neon_session_disabled(monkeypatch):
    monkeypatch.setattr("backend.neon_auth.base_url", lambda: "")
    from backend.main import app
    with TestClient(app) as c:
        resp = c.post("/auth/neon", json={"token": "nope"})
    assert resp.status_code == 503


def test_neon_session_requires_verified_email(monkeypatch):
    monkeypatch.setattr(
        "backend.routers.auth.verify_neon_token",
        lambda token: NeonIdentity(user_id="n1", email="ops@example.test", email_verified=False),
    )
    from backend.main import app
    with TestClient(app) as c:
        resp = c.post("/auth/neon", json={"token": "unverified", "role": "lender", "company_name": "X"})
    assert resp.status_code == 403


def test_neon_session_creates_account(monkeypatch):
    def fake_verify(token: str) -> NeonIdentity:
        assert token == "good-jwt"
        return NeonIdentity(user_id="neon-99", email="ops-neon@example.test", email_verified=True)

    monkeypatch.setattr("backend.routers.auth.verify_neon_token", fake_verify)
    from backend.main import app
    with TestClient(app) as c:
        created = c.post("/auth/neon", json={
            "token": "good-jwt",
            "role": "borrower",
            "company_name": "Example Trading Ltd",
        })
        assert created.status_code == 200, created.text
        body = created.json()
        assert body["account"]["email"] == "ops-neon@example.test"
        assert body["account"]["role"] == "borrower"
        resumed = c.post("/auth/neon", json={"token": "good-jwt"})
        assert resumed.status_code == 200
        assert resumed.json()["account"]["id"] == body["account"]["id"]


def test_neon_session_relinks_after_identity_recreation(monkeypatch):
    identities = {
        "old-jwt": NeonIdentity(
            user_id="neon-old",
            email="recreate@example.test",
            email_verified=True,
            name="Ops",
        ),
        "new-jwt": NeonIdentity(
            user_id="neon-new",
            email="recreate@example.test",
            email_verified=True,
            name="Ops",
        ),
    }
    monkeypatch.setattr(
        "backend.routers.auth.verify_neon_token",
        lambda token: identities[token],
    )
    from backend.main import app
    with TestClient(app) as c:
        created = c.post("/auth/neon", json={
            "token": "old-jwt",
            "role": "lender",
            "company_name": "Relink Ltd",
        })
        assert created.status_code == 200, created.text
        account_id = created.json()["account"]["id"]

        resumed = c.post("/auth/neon", json={"token": "new-jwt"})
        assert resumed.status_code == 200, resumed.text
        assert resumed.json()["account"]["id"] == account_id


def test_neon_session_login_uses_coinfish_role_not_neon_user(monkeypatch):
    monkeypatch.setattr(
        "backend.routers.auth.verify_neon_token",
        lambda token: NeonIdentity(
            user_id="n-lender",
            email="lender-neon@example.test",
            email_verified=True,
            name="Jonathan",
        ),
    )
    from backend.main import app
    with TestClient(app) as c:
        missing = c.post("/auth/neon", json={"token": "good-jwt", "role": "user"})
        assert missing.status_code == 400
        created = c.post("/auth/neon", json={"token": "good-jwt", "role": "lender"})
        assert created.status_code == 200, created.text
        account = created.json()["account"]
        assert account["role"] == "lender"
        assert account["company_name"] == "Jonathan"
