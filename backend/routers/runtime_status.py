"""Runtime mode/readiness for the frontend and deployment checks."""
from __future__ import annotations

from fastapi import APIRouter

from ..runtime import rt

router = APIRouter(prefix="/runtime", tags=["runtime"])


@router.get("/status")
def status() -> dict:
    return rt.status()
