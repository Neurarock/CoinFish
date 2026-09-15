"""Lender/borrower deposit API: JSON errors, validation, mocked XRPL success.

The frontend always JSON.parse()s /api responses. Starlette's default 500 is
plaintext "Internal Server Error", which surfaces as:
    Unexpected token 'I', "Internal S"... is not valid JSON
These tests lock the JSON error contract and the deposit failure modes that
used to leak that plaintext body.
"""
from __future__ import annotations

import json
import uuid
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from backend.db import Account, get_session
from backend.main import app
from backend.runtime import rt


def _json(resp):
    """Assert the body is JSON (the exact failure the deposit UI hit)."""
    ctype = resp.headers.get("content-type", "")
    assert "application/json" in ctype, (
        f"{resp.status_code} {resp.request.method} {resp.request.url.path} "
        f"returned non-JSON: {resp.text!r}"
    )
    try:
        return resp.json()
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"{resp.status_code} body is not JSON: {resp.text!r}"
        ) from exc


def _detail(resp) -> str:
    body = _json(resp)
    detail = body.get("detail", body)
    return detail if isinstance(detail, str) else json.dumps(detail)


@pytest.fixture
def client():
    # raise_server_exceptions=False so we see the HTTP body the browser gets,
    # not a Python traceback bubbling out of TestClient.
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def _signup(client: TestClient, role: str, *, tier: str = "retail") -> tuple[dict, dict]:
    email = f"{role}-{uuid.uuid4().hex[:10]}@example.test"
    resp = client.post("/auth/signup", json={
        "role": role,
        "company_name": f"Test {role.title()}",
        "email": email,
        "password": "demo-pass",
        "lender_tier": tier,
    })
    assert resp.status_code == 200, _detail(resp) if resp.headers.get("content-type", "").startswith("application/json") else resp.text
    body = resp.json()
    return {"Authorization": "Bearer " + body["token"]}, body["account"]


def _attach_wallet(account_id: int, *, seed: str = "sEdTestSeedValue00000000000000") -> None:
    with get_session() as session:
        acct = session.get(Account, account_id)
        assert acct is not None
        acct.xrpl_address = "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"
        acct.xrpl_seed = seed
        acct.wallet_provider = "devnet"
        acct.wallet_rlusd_balance = 500_000.0
        session.add(acct)
        session.commit()


@pytest.fixture
def live_devnet(monkeypatch):
    monkeypatch.setattr("backend.routers.lenders.require_devnet_transactions", lambda action: None)
    monkeypatch.setattr("backend.routers.borrowers.require_devnet_transactions", lambda action: None)
    monkeypatch.setattr(rt, "require_live_ready", lambda **kw: None)
    if not rt.issuer_address:
        monkeypatch.setattr(rt, "issuer_address", "rIssuerTestAddress")
    if not rt.issuer_seed:
        monkeypatch.setattr(rt, "issuer_seed", "sEdTestIssuerSeed000000000000")
    for pool in rt.pools.values():
        if not pool.vault_id:
            pool.vault_id = "A" * 64


@pytest.fixture
def xrpl_ok(monkeypatch):
    ok = SimpleNamespace(ok=True, hash="B" * 64, engine_result="tesSUCCESS")
    monkeypatch.setattr("backend.xrpl_service.vault.deposit", lambda *a, **k: ok)
    monkeypatch.setattr("backend.xrpl_service.vault.withdraw", lambda *a, **k: ok)
    monkeypatch.setattr("backend.xrpl_service.vault.vault_liquidity", lambda *a, **k: (50_000.0, 50_000.0))
    monkeypatch.setattr("backend.xrpl_service.assets.rlusd_balance", lambda *a, **k: 42.5)
    monkeypatch.setattr("backend.xrpl_service.assets.mint_rlusd", lambda *a, **k: ok)
    monkeypatch.setattr("backend.xrpl_service.client.wallet_from_seed", lambda seed: object())
    monkeypatch.setattr("backend.xrpl_service.client.get_client", lambda: object())
    return ok


def test_deposit_requires_auth(client):
    resp = client.post("/lenders/deposit", json={"pool_key": "low", "amount": 100})
    assert resp.status_code == 401
    assert "Not authenticated" in _detail(resp)


def test_deposit_rejects_borrower_role(client):
    headers, _ = _signup(client, "borrower")
    resp = client.post("/lenders/deposit", json={"pool_key": "low", "amount": 100}, headers=headers)
    assert resp.status_code == 403
    assert "lender" in _detail(resp).lower()


def test_deposit_requires_wallet(client, live_devnet):
    headers, _ = _signup(client, "lender", tier="institutional")
    resp = client.post("/lenders/deposit", json={"pool_key": "low", "amount": 100}, headers=headers)
    assert resp.status_code == 400
    assert "wallet" in _detail(resp).lower()


def test_deposit_unknown_pool(client, live_devnet):
    headers, acct = _signup(client, "lender", tier="institutional")
    _attach_wallet(acct["id"])
    resp = client.post("/lenders/deposit", json={"pool_key": "nope", "amount": 100}, headers=headers)
    assert resp.status_code == 404
    assert "unknown pool" in _detail(resp).lower()


def test_deposit_rejects_non_positive_amount(client, live_devnet):
    headers, acct = _signup(client, "lender", tier="institutional")
    _attach_wallet(acct["id"])
    resp = client.post("/lenders/deposit", json={"pool_key": "low", "amount": 0}, headers=headers)
    assert resp.status_code == 400
    assert "positive" in _detail(resp).lower()


def test_deposit_rejects_invalid_body_as_json(client):
    headers, _ = _signup(client, "lender")
    resp = client.post("/lenders/deposit", json={"amount": 100}, headers=headers)
    assert resp.status_code == 422
    body = _json(resp)
    assert "detail" in body


def test_deposit_enforces_pool_tier(client, live_devnet):
    headers, acct = _signup(client, "lender", tier="retail")
    _attach_wallet(acct["id"])
    resp = client.post("/lenders/deposit", json={"pool_key": "high", "amount": 100}, headers=headers)
    assert resp.status_code == 403
    assert "institutional" in _detail(resp).lower()


def test_deposit_vault_engine_failure_is_json_502(client, live_devnet, monkeypatch):
    headers, acct = _signup(client, "lender", tier="institutional")
    _attach_wallet(acct["id"])
    fail = SimpleNamespace(ok=False, hash="", engine_result="tecINSUFFICIENT_FUNDS")
    monkeypatch.setattr("backend.xrpl_service.vault.deposit", lambda *a, **k: fail)
    monkeypatch.setattr("backend.xrpl_service.client.wallet_from_seed", lambda seed: object())
    monkeypatch.setattr("backend.xrpl_service.client.get_client", lambda: object())
    resp = client.post("/lenders/deposit", json={"pool_key": "low", "amount": 100}, headers=headers)
    assert resp.status_code == 502
    assert "tecINSUFFICIENT_FUNDS" in _detail(resp)


def test_deposit_xrpl_exception_is_json_502_not_plaintext(client, live_devnet, monkeypatch):
    headers, acct = _signup(client, "lender", tier="institutional")
    _attach_wallet(acct["id"])

    def boom(*_a, **_k):
        raise RuntimeError("connection reset by peer")

    monkeypatch.setattr("backend.xrpl_service.vault.deposit", boom)
    monkeypatch.setattr("backend.xrpl_service.client.wallet_from_seed", lambda seed: object())
    monkeypatch.setattr("backend.xrpl_service.client.get_client", lambda: object())
    resp = client.post("/lenders/deposit", json={"pool_key": "low", "amount": 100}, headers=headers)
    assert resp.status_code == 502, _detail(resp)
    detail = _detail(resp)
    assert "connection reset" in detail.lower()
    assert not resp.text.startswith("Internal Server Error")


def test_deposit_unhandled_error_returns_json_500(client, live_devnet, xrpl_ok, monkeypatch):
    headers, acct = _signup(client, "lender", tier="institutional")
    _attach_wallet(acct["id"])
    monkeypatch.setattr(
        "backend.routers.lenders.pool_out",
        lambda key: (_ for _ in ()).throw(RuntimeError("pool serialisation exploded")),
    )
    pool = rt.pool("low")
    before = pool.tvl
    try:
        resp = client.post("/lenders/deposit", json={"pool_key": "low", "amount": 250}, headers=headers)
        assert resp.status_code == 500
        assert _detail(resp) == "Internal Server Error"
        assert resp.text.strip().startswith("{"), resp.text
    finally:
        pool.tvl = before


def test_deposit_succeeds_and_shows_on_dashboard(client, live_devnet, xrpl_ok):
    headers, acct = _signup(client, "lender", tier="institutional")
    _attach_wallet(acct["id"])
    pool = rt.pool("low")
    before = pool.tvl
    try:
        resp = client.post("/lenders/deposit", json={"pool_key": "low", "amount": 1_000}, headers=headers)
        assert resp.status_code == 200, _detail(resp)
        body = _json(resp)
        assert body["ok"] is True
        assert body["tx_hash"] == "B" * 64
        assert body["wallet_balance"] == 42.5
        assert "explorer_url" in body
        dash = client.get("/lenders/me/dashboard", headers=headers)
        assert dash.status_code == 200, _detail(dash)
        positions = _json(dash)["positions"]
        assert any(p["key"] == "low" and p["your_principal"] == 1000 for p in positions)
    finally:
        pool.tvl = before


def test_deposit_survives_balance_read_failure(client, live_devnet, xrpl_ok, monkeypatch):
    headers, acct = _signup(client, "lender", tier="institutional")
    _attach_wallet(acct["id"])
    monkeypatch.setattr(
        "backend.xrpl_service.assets.rlusd_balance",
        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("account_lines timeout")),
    )
    pool = rt.pool("low")
    before = pool.tvl
    try:
        resp = client.post("/lenders/deposit", json={"pool_key": "low", "amount": 500}, headers=headers)
        assert resp.status_code == 200, _detail(resp)
        dash = _json(client.get("/lenders/me/dashboard", headers=headers))
        assert any(p["key"] == "low" and p["your_principal"] == 500 for p in dash["positions"])
    finally:
        pool.tvl = before


def test_borrower_rlusd_deposit_requires_wallet(client, live_devnet):
    headers, _ = _signup(client, "borrower")
    resp = client.post("/borrowers/wallet/deposit", json={"amount": 50}, headers=headers)
    assert resp.status_code == 400
    assert "wallet" in _detail(resp).lower()


def test_borrower_rlusd_deposit_xrpl_exception_is_json(client, live_devnet, monkeypatch):
    headers, acct = _signup(client, "borrower")
    _attach_wallet(acct["id"])
    monkeypatch.setattr(
        "backend.xrpl_service.assets.mint_rlusd",
        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("issuer unreachable")),
    )
    monkeypatch.setattr("backend.xrpl_service.client.wallet_from_seed", lambda seed: object())
    monkeypatch.setattr("backend.xrpl_service.client.get_client", lambda: object())
    resp = client.post("/borrowers/wallet/deposit", json={"amount": 50}, headers=headers)
    assert resp.status_code == 502
    assert "issuer unreachable" in _detail(resp)


def test_borrower_rlusd_deposit_succeeds(client, live_devnet, xrpl_ok):
    headers, acct = _signup(client, "borrower")
    _attach_wallet(acct["id"])
    resp = client.post("/borrowers/wallet/deposit", json={"amount": 75}, headers=headers)
    assert resp.status_code == 200, _detail(resp)
    body = _json(resp)
    assert body["ok"] is True
    assert body["amount"] == 75
    assert body["tx_hash"] == "B" * 64
