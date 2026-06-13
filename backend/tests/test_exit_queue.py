"""Unit tests for the off-chain exit queue (no network).

A fake vault models idle liquidity that loans lock up and repayments release, so
we can exercise the rush-for-exit + drain behaviour deterministically.
"""
from __future__ import annotations

import pytest

from backend.exit_queue import ExitQueue, ExitStatus

VID = "VAULT-1"


class FakeVault:
    """In-memory stand-in: `available` is idle liquidity; withdrawals reduce it."""

    def __init__(self, available: float) -> None:
        self.available = available
        self.withdrawals: list[tuple[str, float]] = []
        self._n = 0

    def available_fn(self, vault_id: str) -> float:
        return self.available

    def withdraw_fn(self, vault_id: str, lender: str, amount: float) -> str:
        assert amount <= self.available + 1e-9, "queue over-withdrew idle liquidity"
        self.available = round(self.available - amount, 6)
        self.withdrawals.append((lender, amount))
        self._n += 1
        return f"TX{self._n}"

    def repay(self, amount: float) -> None:
        """A borrower repays -> liquidity returns to the vault."""
        self.available = round(self.available + amount, 6)


def make_queue(available: float) -> tuple[ExitQueue, FakeVault]:
    v = FakeVault(available)
    return ExitQueue(v.available_fn, v.withdraw_fn), v


def test_immediate_full_fill_when_liquidity_ample():
    q, v = make_queue(10_000)
    req = q.request_exit(VID, "alice", 4_000)
    assert req.status is ExitStatus.FILLED
    assert req.amount_filled == 4_000
    assert v.available == 6_000
    assert req.tx_hashes == ["TX1"]


def test_partial_fill_then_queue_when_liquidity_short():
    q, v = make_queue(1_000)            # only 1k idle, rest is lent out
    req = q.request_exit(VID, "alice", 4_000)
    assert req.status is ExitStatus.PARTIAL
    assert req.amount_filled == 1_000
    assert req.remaining == 3_000
    assert v.available == 0
    assert q.outstanding(VID) == 3_000


def test_fifo_head_blocks_followers():
    # 1k idle; alice wants 4k (ahead of bob). Bob must NOT jump the queue even
    # though his 500 would fit — alice is first in line.
    q, v = make_queue(1_000)
    alice = q.request_exit(VID, "alice", 4_000)
    bob = q.request_exit(VID, "bob", 500)
    assert alice.status is ExitStatus.PARTIAL and alice.amount_filled == 1_000
    assert bob.status is ExitStatus.PENDING and bob.amount_filled == 0
    assert [w[0] for w in v.withdrawals] == ["alice"]


def test_queue_drains_as_loans_repay():
    q, v = make_queue(1_000)
    alice = q.request_exit(VID, "alice", 4_000)   # filled 1k, owed 3k
    bob = q.request_exit(VID, "bob", 2_000)       # fully behind alice
    assert alice.amount_filled == 1_000 and bob.amount_filled == 0

    v.repay(2_500)                                # a loan matures
    q.process(VID)
    # alice still owed 3k; 2.5k arrives -> she fills to 3.5k, still owed 0.5k.
    assert alice.amount_filled == 3_500 and alice.status is ExitStatus.PARTIAL
    assert bob.amount_filled == 0                 # bob still blocked behind alice

    v.repay(2_000)                                # another loan matures
    q.process(VID)
    # alice's last 0.5k clears her; the remaining 1.5k starts filling bob.
    assert alice.status is ExitStatus.FILLED and alice.amount_filled == 4_000
    assert bob.amount_filled == 1_500 and bob.status is ExitStatus.PARTIAL

    v.repay(1_000)                                # final maturity drains the queue
    q.process(VID)
    assert bob.status is ExitStatus.FILLED and bob.amount_filled == 2_000
    assert q.outstanding(VID) == 0


def test_everyone_eventually_exits_full_rush():
    # Classic bank-run: 5 lenders of 2k each (10k owed), only 3k idle.
    q, v = make_queue(3_000)
    reqs = [q.request_exit(VID, f"L{i}", 2_000) for i in range(5)]
    assert round(sum(r.amount_filled for r in reqs), 6) == 3_000
    # Loans mature over time, releasing the remaining 7k in chunks.
    for chunk in (2_000, 2_000, 3_000):
        v.repay(chunk)
        q.process(VID)
    assert all(r.status is ExitStatus.FILLED for r in reqs)
    assert q.outstanding(VID) == 0
    # No withdrawal ever exceeded available liquidity (asserted in withdraw_fn).
    assert round(sum(a for _, a in v.withdrawals), 6) == 10_000


def test_zero_liquidity_keeps_everything_pending():
    q, v = make_queue(0)
    req = q.request_exit(VID, "alice", 1_000)
    assert req.status is ExitStatus.PENDING
    assert v.withdrawals == []


def test_rounding_never_overdraws():
    # Liquidity with sub-precision dust must not cause an over-withdrawal.
    q, v = make_queue(100.0000004)
    req = q.request_exit(VID, "alice", 100.5)
    assert req.amount_filled == 100.0      # floored to 6dp, dust dropped
    assert req.status is ExitStatus.PARTIAL


def test_negative_or_zero_request_rejected():
    q, _ = make_queue(1_000)
    with pytest.raises(ValueError):
        q.request_exit(VID, "alice", 0)
    with pytest.raises(ValueError):
        q.request_exit(VID, "alice", -5)
