"""Smoke tests for domain microservice stubs."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.mark.parametrize(
    "modpath,service",
    [
        ("services.auth.main", "auth"),
        ("services.pools.main", "pools"),
        ("services.lending.main", "lending"),
        ("services.borrowing.main", "borrowing"),
        ("services.xrpl.main", "xrpl"),
        ("services.admin.main", "admin"),
    ],
)
def test_service_health(modpath: str, service: str):
    import importlib

    mod = importlib.import_module(modpath)
    client = TestClient(mod.app)
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["service"] == service
    assert client.get("/v1/ready").json()["ready"] is True
