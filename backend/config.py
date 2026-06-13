"""CoinFish configuration.

All secrets here are Devnet-only throwaway seeds. Never use real funds.
Populate seeds by running scripts/bootstrap_devnet.py once, then paste the
printed seeds into your .env (see .env.example).
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()

# --- Network -----------------------------------------------------------------
# The Lending Protocol (XLS-66) amendment is only live on Devnet.
DEVNET_JSON_RPC = "https://s.devnet.rippletest.net:51234"
DEVNET_WS = "wss://s.devnet.rippletest.net:51233"
DEVNET_FAUCET = "https://faucet.devnet.rippletest.net/accounts"
EXPLORER = "https://devnet.xrpl.org"

# --- Our Devnet stand-in stablecoin -----------------------------------------
# Real RLUSD only exists on Testnet/Mainnet, so on Devnet we mint our own IOU
# with the currency code "RLUSD" from the CoinFish issuer wallet.
STABLECOIN_CODE = "RLUSD"


def currency_hex(code: str) -> str:
    """XRPL needs >3-char currency codes as a 40-char hex string."""
    if len(code) <= 3:
        return code
    return code.encode("ascii").hex().upper().ljust(40, "0")


STABLECOIN_HEX = currency_hex(STABLECOIN_CODE)


# --- Wallet seeds (Devnet throwaways; load from env) -------------------------
ISSUER_SEED = os.getenv("COINFISH_ISSUER_SEED", "")      # issues RLUSD
OPERATOR_SEED = os.getenv("COINFISH_OPERATOR_SEED", "")  # vault owner / loan broker / credential issuer


# --- Economics ---------------------------------------------------------------
# Fee + risk parameters expressed as fractions (0.03 == 3%).
MANAGEMENT_FEE = 0.03          # CoinFish cut of lender yield (LoanBroker management fee)
ORIGINATION_FEE = 0.005        # 0.5% of principal, charged to borrower
FIXED_SERVICE_FEE = 1.0        # flat RLUSD service fee per loan
COVER_RATE_LIQUIDATION = 0.10  # max fraction of required cover drawn per default

# Loans are single-payment fixed-term and capped at 24 HOURS. This bounds how
# long lender capital can be locked: a lender queued for exit waits at most one
# loan term (24h) for liquidity to return as loans mature. See exit_queue.py.
MAX_TERM_HOURS = 24
HOUR_SECONDS = 3_600
MIN_TERM_SECONDS = 60          # XLS-66 LoanSet.MIN_PAYMENT_INTERVAL

# The 3 pools CoinFish operates. cover_rate_minimum is the first-loss buffer
# ("flexibility") — lower buffer => higher target APR.
@dataclass
class PoolConfig:
    key: str
    name: str
    risk_tier: str
    cover_rate_minimum: float   # first-loss capital as fraction of debt
    base_apr: float             # floor rate before risk spreads


POOLS: list[PoolConfig] = [
    PoolConfig("low",  "CoinFish Conservative", "low",    0.20, 0.04),
    PoolConfig("med",  "CoinFish Balanced",     "medium", 0.10, 0.08),
    PoolConfig("high", "CoinFish High-Yield",   "high",   0.05, 0.14),
]
