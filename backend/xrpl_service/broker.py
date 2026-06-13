"""Loan Broker (XLS-66) — the CoinFish-owned manager attached to each vault.

Holds the fee config and the first-loss capital ("flexibility" buffer).
"""
from __future__ import annotations

from xrpl.clients import JsonRpcClient
from xrpl.models.transactions import LoanBrokerCoverDeposit, LoanBrokerSet
from xrpl.wallet import Wallet

from .. import config
from .assets import rlusd_amount
from .client import TxResult, submit


def _rate_to_ledger(fraction: float) -> int:
    """Protocol rates are integers scaled by 1e5 (e.g. 0.03 -> 3000)."""
    return int(round(fraction * 100_000))


def create_loan_broker(
    operator: Wallet,
    vault_id: str,
    cover_rate_minimum: float,
    client: JsonRpcClient,
) -> TxResult:
    """Attach a loan broker to a vault with CoinFish's fee + first-loss config."""
    tx = LoanBrokerSet(
        account=operator.address,
        vault_id=vault_id,
        management_fee_rate=_rate_to_ledger(config.MANAGEMENT_FEE),
        cover_rate_minimum=_rate_to_ledger(cover_rate_minimum),
        cover_rate_liquidation=_rate_to_ledger(config.COVER_RATE_LIQUIDATION),
    )
    return submit(tx, operator, client=client)


def deposit_first_loss_capital(
    operator: Wallet, loan_broker_id: str, issuer_address: str, value: str | float, client: JsonRpcClient
) -> TxResult:
    """CoinFish posts first-loss capital so the broker can issue loans + take fees."""
    tx = LoanBrokerCoverDeposit(
        account=operator.address,
        loan_broker_id=loan_broker_id,
        amount=rlusd_amount(value, issuer_address),
    )
    return submit(tx, operator, client=client)


def loan_broker_id_from_result(tx_result: TxResult) -> str | None:
    for node in tx_result.raw.get("meta", {}).get("AffectedNodes", []):
        created = node.get("CreatedNode", {})
        if created.get("LedgerEntryType") == "LoanBroker":
            return created.get("LedgerIndex")
    return None


def cover_available(loan_broker_id: str, client: JsonRpcClient) -> float:
    """First-loss capital (CoverAvailable) currently backing the broker's loans."""
    from xrpl.models.requests import LedgerEntry

    res = client.request(LedgerEntry(index=loan_broker_id, ledger_index="validated")).result
    return float((res.get("node") or {}).get("CoverAvailable", "0") or 0)
