"""Runtime setup loading must not depend on process cwd (Vercel serverless)."""
from __future__ import annotations

import os

os.environ["COINFISH_DB_URL"] = "sqlite:////tmp/coinfish-test-runtime-setup.db"

from backend.runtime import Runtime


def test_runtime_loads_packaged_public_ids_when_cwd_empty(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("COINFISH_SETUP_JSON", str(tmp_path / "missing-setup.json"))
    monkeypatch.delenv("COINFISH_PUBLIC_SETUP_JSON", raising=False)
    monkeypatch.delenv("COINFISH_ISSUER_ADDRESS", raising=False)
    for key in ("LOW", "MED", "HIGH"):
        monkeypatch.delenv(f"COINFISH_POOL_{key}_VAULT_ID", raising=False)
        monkeypatch.delenv(f"COINFISH_POOL_{key}_LOAN_BROKER_ID", raising=False)

    runtime = Runtime()
    assert runtime.issuer_address == "rar59DUbTjZq6XqKkSYN9rkg8SAP3hxMaw"
    assert runtime.pools["low"].vault_id
    assert runtime.pools["med"].loan_broker_id
    assert runtime.pools["high"].vault_id

    joined = "; ".join(runtime.live_warnings())
    assert "issuer_address is missing" not in joined
    assert "vault_id is missing" not in joined
    assert "loan_broker_id is missing" not in joined
