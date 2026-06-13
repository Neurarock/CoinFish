"""RLUSD stand-in stablecoin: issuance + trustlines.

Ported from the starter repo's trustline.py / rlusd_transaction.py, but using
the CoinFish issuer wallet on Devnet instead of the (Testnet-only) real RLUSD.
"""
from __future__ import annotations

from xrpl.clients import JsonRpcClient
from xrpl.models.amounts import IssuedCurrencyAmount
from xrpl.models.transactions import AccountSet, AccountSetAsfFlag, Payment, TrustSet
from xrpl.wallet import Wallet

from .. import config
from .client import TxResult, submit


def rlusd_amount(value: str | float, issuer: str) -> IssuedCurrencyAmount:
    return IssuedCurrencyAmount(
        currency=config.STABLECOIN_HEX, issuer=issuer, value=str(value)
    )


def enable_rippling(issuer: Wallet, client: JsonRpcClient) -> TxResult:
    """Issuer must set DefaultRipple so its IOU can flow between third parties."""
    tx = AccountSet(account=issuer.address, set_flag=AccountSetAsfFlag.ASF_DEFAULT_RIPPLE)
    return submit(tx, issuer, client=client)


def create_trustline(
    holder: Wallet, issuer_address: str, client: JsonRpcClient, limit: str = "1000000000"
) -> TxResult:
    """Holder trusts the CoinFish RLUSD issuer up to `limit`."""
    tx = TrustSet(
        account=holder.address,
        limit_amount=IssuedCurrencyAmount(
            currency=config.STABLECOIN_HEX, issuer=issuer_address, value=limit
        ),
    )
    return submit(tx, holder, client=client)


def rlusd_balance(address: str, issuer_address: str, client: JsonRpcClient) -> float:
    """Read an account's RLUSD balance from its trust lines (0.0 if none)."""
    from xrpl.models.requests import AccountLines

    lines = client.request(AccountLines(account=address)).result.get("lines", [])
    for ln in lines:
        if ln.get("currency") == config.STABLECOIN_HEX and ln.get("account") == issuer_address:
            return float(ln.get("balance", "0"))
    return 0.0


def mint_rlusd(
    issuer: Wallet, destination: str, value: str | float, client: JsonRpcClient
) -> TxResult:
    """Issue RLUSD from the issuer to a trustline-holding destination."""
    tx = Payment(
        account=issuer.address,
        destination=destination,
        amount=rlusd_amount(value, issuer.address),
    )
    return submit(tx, issuer, client=client)
