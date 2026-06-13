"""Fast local API smoke test for the CoinFish UX.

Runs entirely in process with FastAPI TestClient and a throwaway SQLite DB. This
does not disable Devnet or fabricate receipts; it avoids money-moving endpoints
so every transaction-producing path remains live-only.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

os.environ["COINFISH_DB_URL"] = "sqlite:////tmp/coinfish-smoke-local.db"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

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
        assert all(p["vault_explorer_url"].startswith("https://devnet.xrpl.org/objects/")
                   for p in pools)

        status = ok(c.get("/runtime/status"))
        assert status["mode"] == "xrpl-devnet-live"

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
        dash = ok(c.get("/lenders/me/dashboard", headers=lh))
        assert dash["total_deposited"] == 0

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
        ok(c.post("/borrowers/collateral/confirm", json={"amount": 100000}, headers=bh))
        quote = ok(c.post("/borrowers/quote", json={
            "pool_key": "low",
            "amount": 40000,
            "term_hours": 24,
        }, headers=bh))
        assert quote["approved"] is True
        bd = ok(c.get("/borrowers/me/dashboard", headers=bh))
        assert bd["collateral_available"] == 100000

        vault = ok(c.get("/admin/dashboard"))
        assert "risk_score" in vault

    print("CoinFish smoke test passed")


if __name__ == "__main__":
    main()
