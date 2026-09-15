"""XRPL submit helper must turn transport errors into failed TxResult, not 500s."""
from __future__ import annotations

from unittest.mock import MagicMock

from backend.xrpl_service.client import submit, submit_signed


def test_submit_maps_transport_error_to_failed_result(monkeypatch):
    monkeypatch.setattr(
        "backend.xrpl_service.client.submit_and_wait",
        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("connection reset")),
    )
    res = submit(MagicMock(), MagicMock(), client=MagicMock())
    assert res.ok is False
    assert res.hash == ""
    assert "connection reset" in res.engine_result


def test_submit_signed_maps_transport_error_to_failed_result(monkeypatch):
    monkeypatch.setattr(
        "backend.xrpl_service.client.submit_and_wait",
        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("timed out")),
    )
    res = submit_signed(MagicMock(), client=MagicMock())
    assert res.ok is False
    assert "timed out" in res.engine_result
