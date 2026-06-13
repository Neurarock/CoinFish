"""Runtime app state: pool registry, wallets, exit queues, quote cache.

This is the in-memory glue between the FastAPI routers and the chain service.
It loads the bootstrap output (vault/broker/domain ids + operator/issuer seeds)
from a `setup.json` written by scripts/bootstrap_devnet.py (or from env), and
exposes the per-vault exit queues and the short-lived loan-quote cache.

XRPL Devnet is the only chain mode. Devnet is already the test environment, so
frontend-driven wallet, vault, loan, repayment, withdrawal, and default actions
must submit real Devnet transactions and persist real explorer links.
"""
from __future__ import annotations

import json
import os
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from . import config
from .exit_queue import ExitQueue

LIVE_CHAIN = True
SETUP_PATH = Path(os.getenv("COINFISH_SETUP_JSON", "setup.json"))


@dataclass
class PoolRuntime:
    key: str
    name: str
    risk_tier: str
    cover_rate_minimum: float
    base_apr: float
    default_term_hours: int = 24
    vault_id: str = ""
    loan_broker_id: str = ""
    # demo-mode mirror of on-chain liquidity so dashboards have live numbers
    tvl: float = 0.0
    drawn: float = 0.0            # principal currently out on loan
    first_loss_capital: float = 0.0

    @property
    def available(self) -> float:
        return max(0.0, self.tvl - self.drawn)

    @property
    def utilisation(self) -> float:
        return 0.0 if self.tvl <= 0 else min(1.0, self.drawn / self.tvl)


@dataclass
class Quote:
    id: str
    account_id: int
    pool_key: str
    principal: float
    interest_rate: float
    term_hours: int
    origination_fee: float
    expires_at: float            # unix ts; quotes are live for QUOTE_TTL seconds
    approved: bool
    reason: str = ""

    @property
    def seconds_left(self) -> float:
        return max(0.0, round(self.expires_at - time.time(), 1))

    @property
    def live(self) -> bool:
        return self.seconds_left > 0


QUOTE_TTL = 5.0  # seconds — matches the "live for 5 seconds" UX requirement


class Runtime:
    def __init__(self) -> None:
        self.domain_id: str = os.getenv("COINFISH_DOMAIN_ID", "")
        self.operator_seed: str = config.OPERATOR_SEED
        self.issuer_seed: str = config.ISSUER_SEED
        self.issuer_address: str = os.getenv("COINFISH_ISSUER_ADDRESS", "")
        self.pools: dict[str, PoolRuntime] = {
            p.key: PoolRuntime(p.key, p.name, p.risk_tier, p.cover_rate_minimum,
                               p.base_apr, p.default_term_hours)
            for p in config.POOLS
        }
        self.quotes: dict[str, Quote] = {}
        self.exit_queues: dict[str, ExitQueue] = {}
        self.fees_collected: float = 0.0      # CoinFish cumulative fee revenue (demo)
        self._load_setup()
        self._seed_demo_liquidity()

    # -- setup ------------------------------------------------------------
    def _load_setup(self) -> None:
        if not SETUP_PATH.exists():
            data = {}
        else:
            data = json.loads(SETUP_PATH.read_text())
        self.domain_id = data.get("domain_id", self.domain_id)
        self.operator_seed = data.get("operator_seed", self.operator_seed)
        self.issuer_seed = data.get("issuer_seed", self.issuer_seed)
        self.issuer_address = data.get("issuer_address", self.issuer_address)
        for p in data.get("pools", []):
            pr = self.pools.get(p["key"])
            if pr:
                pr.vault_id = p.get("vault_id", "")
                pr.loan_broker_id = p.get("loan_broker_id", "")
        for key, pr in self.pools.items():
            env_key = key.upper().replace("-", "_")
            pr.vault_id = os.getenv(f"COINFISH_POOL_{env_key}_VAULT_ID", pr.vault_id)
            pr.loan_broker_id = os.getenv(
                f"COINFISH_POOL_{env_key}_LOAN_BROKER_ID",
                pr.loan_broker_id,
            )

    def _seed_demo_liquidity(self) -> None:
        """Give each pool plausible starting numbers so the UI looks alive."""
        seed = {"low": (500_000, 180_000, 100_000),
                "med": (320_000, 210_000, 32_000),
                "high": (140_000, 119_000, 7_000)}
        for key, (tvl, drawn, flc) in seed.items():
            if key in self.pools:
                self.pools[key].tvl = tvl
                self.pools[key].drawn = drawn
                self.pools[key].first_loss_capital = flc

    # -- helpers ----------------------------------------------------------
    def pool(self, key: str) -> Optional[PoolRuntime]:
        return self.pools.get(key)

    def new_quote(self, **kw) -> Quote:
        q = Quote(id=uuid.uuid4().hex[:12], expires_at=time.time() + QUOTE_TTL, **kw)
        self.quotes[q.id] = q
        return q

    def live_warnings(self) -> list[str]:
        warnings: list[str] = []
        if not self.issuer_address:
            warnings.append("COINFISH_ISSUER_ADDRESS or setup.json issuer_address is missing")
        if not self.issuer_seed:
            warnings.append("COINFISH_ISSUER_SEED or setup.json issuer_seed is missing")
        if not self.operator_seed:
            warnings.append("COINFISH_OPERATOR_SEED or setup.json operator_seed is missing")
        for key, pool in self.pools.items():
            if not pool.vault_id:
                warnings.append(f"pool {key} vault_id is missing")
            if not pool.loan_broker_id:
                warnings.append(f"pool {key} loan_broker_id is missing")
        return warnings

    def require_live_ready(self, *, pool_key: str | None = None, need_broker: bool = False) -> None:
        warnings = self.live_warnings()
        if pool_key:
            pool = self.pool(pool_key)
            if not pool:
                warnings.append(f"unknown pool {pool_key}")
            else:
                if not pool.vault_id:
                    warnings.append(f"pool {pool_key} vault_id is missing")
                if need_broker and not pool.loan_broker_id:
                    warnings.append(f"pool {pool_key} loan_broker_id is missing")
        if warnings:
            raise RuntimeError("; ".join(warnings))

    def status(self) -> dict:
        warnings = self.live_warnings()
        return {
            "live_chain": LIVE_CHAIN,
            "requires_devnet_transactions": True,
            "mode": "xrpl-devnet-live",
            "devnet_ready": not warnings,
            "warnings": warnings,
            "issuer_address": self.issuer_address,
            "domain_id": self.domain_id,
            "pools": [
                {
                    "key": key,
                    "vault_id": pool.vault_id,
                    "loan_broker_id": pool.loan_broker_id,
                    "ready": bool(pool.vault_id and pool.loan_broker_id),
                }
                for key, pool in self.pools.items()
            ],
        }


# module-level singleton used by the routers
rt = Runtime()
