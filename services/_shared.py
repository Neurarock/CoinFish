"""Shared helpers for CoinFish FastAPI microservices."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def create_service_app(*, title: str, version: str = "0.1.0", service: str) -> FastAPI:
    app = FastAPI(title=title, version=version)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok", "service": service}

    @app.get("/")
    def root() -> dict:
        return {"service": service, "title": title, "version": version}

    return app
