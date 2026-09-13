"""Admin microservice — vault / operator control plane."""
from __future__ import annotations

from services._shared import create_service_app

app = create_service_app(title="CoinFish Admin", service="admin")


@app.get("/v1/ready")
def ready() -> dict:
    return {"ready": True, "service": "admin"}
