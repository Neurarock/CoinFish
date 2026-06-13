"""Off-chain interest-rate + credit logic. Fully in CoinFish's control.

Encodes: longer committed term => cheaper; higher LTV / lower credit score /
higher pool utilisation => more expensive. Output feeds LoanSet.interest_rate.
"""
from __future__ import annotations

from dataclasses import dataclass

from . import config


@dataclass
class Quote:
    principal: float
    interest_rate: float   # annualised fraction, e.g. 0.11 == 11%
    term_days: int
    origination_fee: float
    approved: bool
    reason: str = ""


def _credit_spread(credit_score: int) -> float:
    # 850 (best) -> 0 spread; 500 (poor) -> ~7% spread
    score = max(300, min(850, credit_score))
    return (850 - score) / 350 * 0.07


def _ltv_spread(loan: float, fiat_deposit: float) -> float:
    if fiat_deposit <= 0:
        return 1.0
    ltv = loan / fiat_deposit
    return ltv * 0.05  # higher collateral utilisation costs more


def _utilisation_spread(pool_drawn: float, pool_tvl: float) -> float:
    if pool_tvl <= 0:
        return 0.10
    return (pool_drawn / pool_tvl) * 0.04


def _term_discount(term_days: int) -> float:
    # Longer committed term => discount (max term is cheapest).
    return term_days / config.MAX_TERM_DAYS * 0.03


def quote_loan(
    *,
    pool: config.PoolConfig,
    principal: float,
    credit_score: int,
    fiat_deposit: float,
    credit_limit: float,
    term_days: int,
    pool_drawn: float = 0.0,
    pool_tvl: float = 0.0,
) -> Quote:
    term_days = min(term_days, config.MAX_TERM_DAYS)
    origination_fee = principal * config.ORIGINATION_FEE + config.FIXED_SERVICE_FEE

    if principal > credit_limit:
        return Quote(principal, 0.0, term_days, origination_fee, False,
                     f"Requested {principal} exceeds credit limit {credit_limit}")
    if principal > fiat_deposit:
        return Quote(principal, 0.0, term_days, origination_fee, False,
                     "Insufficient off-chain fiat collateral")

    rate = (
        pool.base_apr
        + _credit_spread(credit_score)
        + _ltv_spread(principal, fiat_deposit)
        + _utilisation_spread(pool_drawn, pool_tvl)
        - _term_discount(term_days)
    )
    rate = max(pool.base_apr * 0.5, round(rate, 4))
    return Quote(principal, rate, term_days, origination_fee, True)
