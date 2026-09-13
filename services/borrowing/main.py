"""Borrowing microservice — collateral, quotes, drawdowns, repayments."""
from __future__ import annotations

from services._shared import create_service_app

app = create_service_app(title="CoinFish Borrowing", service="borrowing")


@app.get("/v1/ready")
def ready() -> dict:
    return {"ready": True, "service": "borrowing"}
