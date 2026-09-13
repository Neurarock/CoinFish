"""Pools microservice — risk-tiered liquidity pools."""
from __future__ import annotations

from services._shared import create_service_app

app = create_service_app(title="CoinFish Pools", service="pools")


@app.get("/v1/ready")
def ready() -> dict:
    return {"ready": True, "service": "pools"}
