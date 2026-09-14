"""Verify Neon Managed Better Auth JWTs and map them onto CoinFish accounts.

Neon owns email/password + OTP. CoinFish keeps the product session (opaque
bearer token) and the Account row (role, KYC, wallet). JWTs expire in 15
minutes, so the API exchanges a verified token once rather than using it on
every request.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import urlparse

import jwt
from fastapi import HTTPException
from jwt import PyJWKClient

_jwks_client: PyJWKClient | None = None
_jwks_url = ""


def base_url() -> str:
    return (os.getenv("NEON_AUTH_BASE_URL") or "").rstrip("/")


def enabled() -> bool:
    return bool(base_url())


def _origin(url: str) -> str:
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        raise HTTPException(503, "NEON_AUTH_BASE_URL is not a valid Auth URL")
    return f"{parsed.scheme}://{parsed.netloc}"


def _jwks() -> PyJWKClient:
    global _jwks_client, _jwks_url
    url = f"{base_url()}/.well-known/jwks.json"
    if _jwks_client is None or _jwks_url != url:
        _jwks_client = PyJWKClient(url, cache_jwk_set=True, lifespan=600)
        _jwks_url = url
    return _jwks_client


@dataclass(frozen=True)
class NeonIdentity:
    user_id: str
    email: str
    email_verified: bool
    name: str = ""


def identity_from_claims(payload: dict) -> NeonIdentity:
    email = str(payload.get("email") or "").strip().lower()
    user_id = str(payload.get("id") or payload.get("sub") or "").strip()
    verified = bool(payload.get("emailVerified") or payload.get("email_verified"))
    name = str(payload.get("name") or "").strip()
    if not email or not user_id:
        raise HTTPException(401, "identity token is missing email or subject")
    return NeonIdentity(user_id=user_id, email=email, email_verified=verified, name=name)


def verify_neon_token(token: str) -> NeonIdentity:
    url = base_url()
    if not url:
        raise HTTPException(503, "Neon Auth is not configured")
    token = (token or "").strip()
    if not token:
        raise HTTPException(401, "missing identity token")
    try:
        signing_key = _jwks().get_signing_key_from_jwt(token)
        origin = _origin(url)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["EdDSA"],
            issuer=origin,
            audience=origin,
            options={"require": ["sub", "exp"]},
        )
    except HTTPException:
        raise
    except jwt.PyJWTError as exc:
        raise HTTPException(401, "invalid or expired identity token") from exc
    except Exception as exc:
        raise HTTPException(401, "invalid or expired identity token") from exc
    return identity_from_claims(payload)
