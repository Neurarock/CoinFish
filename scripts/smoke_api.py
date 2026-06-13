"""End-to-end API smoke test for the local/demo CoinFish UX.

Runs entirely in process with FastAPI TestClient and a throwaway SQLite DB.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

os.environ["COINFISH_DB_URL"] = "sqlite:////tmp/coinfish-smoke-local.db"
os.environ["COINFISH_REQUIRE_DEVNET_TRANSACTIONS"] = "0"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from backend import services  # noqa: E402
from backend.main import app  # noqa: E402


def ok(resp):
    if resp.status_code >= 400:
        raise AssertionError(
            f"{resp.request.method} {resp.request.url.path} -> "
            f"{resp.status_code}: {resp.text}"
        )
    return resp.json()


def main() -> None:
    suffix = int(time.time())

    with TestClient(app) as c:
        pools = ok(c.get("/pools"))
        assert len(pools) == 3

        lender = ok(c.post("/auth/signup", json={
            "role": "lender",
            "company_name": "Smoke Lender Ltd",
            "email": f"lender-smoke-{suffix}@example.test",
            "password": "demo-pass",
            "contact_name": "Lee",
            "company_number": "LEND123",
        }))
        lh = {"Authorization": "Bearer " + lender["token"]}
        ok(c.post("/auth/verify/kyc", headers=lh))
        wallet = ok(c.post("/auth/wallet/connect", json={"provider": "crossmark"}, headers=lh))
        assert wallet["provider"] == "crossmark"
        assert wallet["xrpl_address"].startswith("r")
        assert wallet["rlusd_balance"] == 500000
        assert wallet["explorer_url"] == ""

        dep = ok(c.post("/lenders/deposit", json={
            "pool_key": "low",
            "amount": 25000,
        }, headers=lh))
        assert dep["explorer_url"] == ""
        assert dep["receipt_url"].startswith("/api/receipts/")
        dash = ok(c.get("/lenders/me/dashboard", headers=lh))
        assert dash["total_deposited"] == 25000

        wd = ok(c.post("/lenders/withdraw", json={
            "pool_key": "low",
            "amount": 5000,
        }, headers=lh))
        assert wd["filled"] == 5000
        assert wd["explorer_urls"] == [""]
        assert wd["receipt_urls"][0].startswith("/api/receipts/")
        dash = ok(c.get("/lenders/me/dashboard", headers=lh))
        assert dash["total_deposited"] == 20000

        services._TOKENS.clear()
        me = ok(c.get("/auth/me", headers=lh))
        assert me["wallet_connected"] is True

        borrower = ok(c.post("/auth/signup", json={
            "role": "borrower",
            "company_name": "Smoke Borrower Ltd",
            "email": f"borrower-smoke-{suffix}@example.test",
            "password": "demo-pass",
            "contact_name": "Bo",
            "company_number": "BORR123",
        }))
        bh = {"Authorization": "Bearer " + borrower["token"]}
        ok(c.post("/auth/verify/kyc", headers=bh))
        ok(c.post("/auth/verify/credit", headers=bh))
        ok(c.post("/auth/wallet/connect", json={"provider": "xaman"}, headers=bh))
        ok(c.post("/borrowers/collateral/confirm", json={"amount": 100000}, headers=bh))
        quote = ok(c.post("/borrowers/quote", json={
            "pool_key": "low",
            "amount": 40000,
            "term_hours": 24,
        }, headers=bh))
        assert quote["approved"] is True
        loan = ok(c.post("/borrowers/loans/accept", json={
            "quote_id": quote["id"],
        }, headers=bh))
        assert loan["explorer_url"] == ""
        assert loan["receipt_url"].startswith("/api/receipts/")
        bd = ok(c.get("/borrowers/me/dashboard", headers=bh))
        assert bd["collateral_available"] == 60000

        vault = ok(c.get("/admin/dashboard"))
        assert "risk_score" in vault

    print("CoinFish smoke test passed")


if __name__ == "__main__":
    main()
