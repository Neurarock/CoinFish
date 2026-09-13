"""Auth microservice — identity / session / KYC surface."""
from __future__ import annotations

from services._shared import create_service_app

app = create_service_app(title="CoinFish Auth", service="auth")


@app.get("/v1/ready")
def ready() -> dict:
    return {"ready": True, "service": "auth"}
