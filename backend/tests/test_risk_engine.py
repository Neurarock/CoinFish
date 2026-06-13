"""Unit tests for the off-chain rate/credit engine (no network)."""
from __future__ import annotations

from backend import config
from backend.risk_engine import quote_loan

POOL = config.POOLS[1]  # Balanced


def _quote(**kw):
    base = dict(pool=POOL, principal=10_000, credit_score=710, fiat_deposit=15_000,
                credit_limit=12_000, term_hours=24, pool_drawn=0.0, pool_tvl=25_000)
    base.update(kw)
    return quote_loan(**base)


def test_term_is_capped_at_max():
    q = _quote(term_hours=999)
    assert q.term_hours == config.MAX_TERM_HOURS == 72


def test_term_has_a_floor():
    q = _quote(term_hours=0)
    assert q.term_hours >= 1


def test_rejects_over_credit_limit():
    q = _quote(principal=20_000)
    assert not q.approved and "credit limit" in q.reason


def test_rejects_under_collateralised():
    q = _quote(principal=11_000, fiat_deposit=10_000)  # within limit, over collateral
    assert not q.approved and "collateral" in q.reason


def test_lower_credit_score_costs_more():
    good = _quote(credit_score=800)
    poor = _quote(credit_score=550)
    assert poor.interest_rate > good.interest_rate


def test_higher_utilisation_costs_more():
    quiet = _quote(pool_drawn=0, pool_tvl=25_000)
    busy = _quote(pool_drawn=20_000, pool_tvl=25_000)
    assert busy.interest_rate > quiet.interest_rate


def test_longer_term_is_cheaper():
    short = _quote(term_hours=1)
    long = _quote(term_hours=24)
    assert long.interest_rate < short.interest_rate


def test_rate_floored_at_half_base_apr():
    # An ideal borrower on a max term still can't price below the floor.
    q = _quote(credit_score=850, principal=1, fiat_deposit=1_000_000, term_hours=24)
    assert q.interest_rate >= POOL.base_apr * 0.5


def test_origination_fee_is_principal_pct_plus_fixed():
    q = _quote(principal=10_000)
    assert q.origination_fee == 10_000 * config.ORIGINATION_FEE + config.FIXED_SERVICE_FEE
