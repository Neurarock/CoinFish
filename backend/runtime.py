"""Runtime app state: pool registry, wallets, exit queues, quote cache.

This is the in-memory glue between the FastAPI routers and the chain service.
It loads the bootstrap output (vault/broker/domain ids + operator/issuer seeds)
from a `setup.json` written by scripts/bootstrap_devnet.py (or from env), and
exposes the per-vault exit queues and the short-lived loan-quote cache.

LIVE_CHAIN toggle
-----------------
The on-chain layer is verified working on Devnet, but live submits take several
seconds each and need network. For UI development the routers can run in
off-chain demo mode (LIVE_CHAIN=False, the default), where deposits/loans/repays
update the SQLite mirror and return synthetic tx hashes, so the whole journey is
clickable instantly. Flip COINFISH_LIVE_CHAIN=1 to route the same calls through
xrpl_service against Devnet.
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

LIVE_CHAIN = os.getenv("COINFISH_LIVE_CHAIN", "0") == "1"
SETUP_PATH = Path(os.getenv("COINFISH_SETUP_JSON", "setup.json"))


@dataclass
class PoolRuntime:
    key: str
    name: str
    risk_tier: str
    cover_rate_minimum: float
    base_apr: float
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
            p.key: PoolRuntime(p.key, p.name, p.risk_tier, p.cover_rate_minimum, p.base_apr)
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
            return
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

    def fake_tx_hash(self) -> str:
        return uuid.uuid4().hex.upper() + uuid.uuid4().hex.upper()[:32]


# module-level singleton used by the routers
rt = Runtime()
