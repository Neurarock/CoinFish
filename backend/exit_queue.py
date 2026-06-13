"""Exit (withdrawal) queue for vault lenders.

The problem: an XRPL vault serves withdrawals first-come-first-serve, but a
`VaultWithdraw` can only draw on *idle* liquidity (`Vault.AssetsAvailable`).
Capital lent out to borrowers is NOT withdrawable until those loans repay or
mature. So if every lender rushes for the exit at once while most of the pool is
lent out, only the idle slice can be paid immediately — the rest must wait.

CoinFish bounds that wait: every loan is capped at 24h (see config.MAX_TERM_HOURS),
so all lent capital returns to the vault within one loan term. This module manages
the exit rush OFF-CHAIN as a fair FIFO queue: requests are filled against current
available liquidity, partially if needed, and the remainder is drained as loans
repay. The head of the queue always has priority — a request that can only be
partially filled is filled partially and blocks the queue until more liquidity
arrives, so no one jumps ahead.

Chain access is injected (`available_fn`, `withdraw_fn`) so the queue logic is
pure and unit-testable with no network. The live adapter is built in
scripts/run_exit_demo.py.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable

# RLUSD on our Devnet vault uses Scale 6; round fills to 6 dp so the amount is
# always valid for an issued-currency VaultWithdraw and never over-draws by dust.
_DECIMALS = 6
_EPSILON = 1e-6


def _floor(value: float) -> float:
    """Floor to the vault's decimal precision (never round liquidity up)."""
    factor = 10 ** _DECIMALS
    return int(value * factor) / factor


class ExitStatus(str, Enum):
    PENDING = "pending"    # nothing filled yet
    PARTIAL = "partial"    # some filled, waiting on liquidity for the rest
    FILLED = "filled"      # fully satisfied


@dataclass
class ExitRequest:
    id: int
    vault_id: str
    lender: str
    amount_requested: float
    amount_filled: float = 0.0
    status: ExitStatus = ExitStatus.PENDING
    created_at: float = field(default_factory=time.time)
    tx_hashes: list[str] = field(default_factory=list)

    @property
    def remaining(self) -> float:
        return round(self.amount_requested - self.amount_filled, _DECIMALS)

    @property
    def done(self) -> bool:
        return self.status is ExitStatus.FILLED


# available_fn(vault_id) -> idle RLUSD withdrawable right now
AvailableFn = Callable[[str], float]
# withdraw_fn(vault_id, lender, amount) -> tx hash; must raise on failure
WithdrawFn = Callable[[str, str, float], str]


class ExitQueue:
    """A per-vault FIFO queue of lender exit requests."""

    def __init__(self, available_fn: AvailableFn, withdraw_fn: WithdrawFn) -> None:
        self._available_fn = available_fn
        self._withdraw_fn = withdraw_fn
        self._queues: dict[str, list[ExitRequest]] = {}
        self._next_id = 1

    # -- inspection --------------------------------------------------------
    def queue(self, vault_id: str) -> list[ExitRequest]:
        return list(self._queues.get(vault_id, []))

    def pending(self, vault_id: str) -> list[ExitRequest]:
        return [r for r in self._queues.get(vault_id, []) if not r.done]

    def outstanding(self, vault_id: str) -> float:
        """Total RLUSD still owed to everyone waiting in the queue."""
        return round(sum(r.remaining for r in self.pending(vault_id)), _DECIMALS)

    # -- operations --------------------------------------------------------
    def request_exit(self, vault_id: str, lender: str, amount: float) -> ExitRequest:
        """Queue a lender's exit, then immediately try to fill from idle liquidity."""
        if amount <= 0:
            raise ValueError("exit amount must be positive")
        req = ExitRequest(id=self._next_id, vault_id=vault_id, lender=lender,
                          amount_requested=round(amount, _DECIMALS))
        self._next_id += 1
        self._queues.setdefault(vault_id, []).append(req)
        self.process(vault_id)
        return req

    def process(self, vault_id: str) -> list[ExitRequest]:
        """Fill as many queued exits as current liquidity allows, in FIFO order.

        Returns the requests touched in this pass. The head of the queue is
        always served first; if it can only be partially filled, it is and we
        stop — later requests never overtake an unfilled earlier one.
        """
        available = _floor(self._available_fn(vault_id))
        touched: list[ExitRequest] = []
        for req in self._queues.get(vault_id, []):
            if req.done:
                continue
            if available <= _EPSILON:
                break  # no liquidity left this pass
            fill = _floor(min(req.remaining, available))
            if fill <= _EPSILON:
                break  # head can't be advanced; hold the line (FIFO fairness)
            tx_hash = self._withdraw_fn(vault_id, req.lender, fill)
            req.amount_filled = round(req.amount_filled + fill, _DECIMALS)
            req.tx_hashes.append(tx_hash)
            req.status = ExitStatus.FILLED if req.remaining <= _EPSILON else ExitStatus.PARTIAL
            available = round(available - fill, _DECIMALS)
            touched.append(req)
            if req.status is ExitStatus.PARTIAL:
                break  # request still owed; don't serve anyone behind it
        return touched
