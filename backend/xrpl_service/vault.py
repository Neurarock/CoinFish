"""Single Asset Vault (XLS-65) — one vault per CoinFish pool.

A private, domain-gated vault holding our RLUSD IOU. Lenders deposit RLUSD and
receive vault shares (an MPT); the loan broker draws on the vault to fund loans.
"""
from __future__ import annotations

from typing import Any

from xrpl.clients import JsonRpcClient
from xrpl.models.currencies import IssuedCurrency
from xrpl.models.requests import Request
from xrpl.models.transactions import VaultCreate, VaultDeposit, VaultWithdraw
from xrpl.models.transactions.vault_create import VaultCreateFlag, WithdrawalPolicy
from xrpl.utils import str_to_hex
from xrpl.wallet import Wallet

from .. import config
from .assets import rlusd_amount
from .client import TxResult, submit


def _rlusd_asset(issuer_address: str) -> IssuedCurrency:
    return IssuedCurrency(currency=config.STABLECOIN_HEX, issuer=issuer_address)


def create_vault(
    operator: Wallet,
    issuer_address: str,
    domain_id: str | None,
    name: str,
    client: JsonRpcClient,
    private: bool = False,
) -> TxResult:
    """Create an RLUSD vault for one pool.

    MVP decision: vaults are PUBLIC on the deposit side so lenders can supply
    without KYC. The borrower allowlist is enforced separately via the
    CoinFish-Borrower credential + permissioned domain at loan origination.
    Set private=True (with a domain_id) to gate depositors too.
    """
    kwargs = dict(
        account=operator.address,
        asset=_rlusd_asset(issuer_address),
        data=str_to_hex(name),
        assets_maximum="0",  # no cap
        withdrawal_policy=WithdrawalPolicy.VAULT_STRATEGY_FIRST_COME_FIRST_SERVE,
    )
    if private and domain_id:
        kwargs["flags"] = VaultCreateFlag.TF_VAULT_PRIVATE
        kwargs["domain_id"] = domain_id
    return submit(VaultCreate(**kwargs), operator, client=client)


def deposit(
    lender: Wallet, vault_id: str, issuer_address: str, value: str | float, client: JsonRpcClient
) -> TxResult:
    tx = VaultDeposit(
        account=lender.address,
        vault_id=vault_id,
        amount=rlusd_amount(value, issuer_address),
    )
    return submit(tx, lender, client=client)


def withdraw(
    lender: Wallet, vault_id: str, issuer_address: str, value: str | float, client: JsonRpcClient
) -> TxResult:
    tx = VaultWithdraw(
        account=lender.address,
        vault_id=vault_id,
        amount=rlusd_amount(value, issuer_address),
    )
    return submit(tx, lender, client=client)


def vault_info(vault_id: str, client: JsonRpcClient) -> dict[str, Any]:
    """Read back vault state (TVL, shares, etc.) via the vault_info method."""
    req = Request(method="vault_info", vault_id=vault_id, ledger_index="validated")  # type: ignore[call-arg]
    return client.request(req).result


def vault_node(vault_id: str, client: JsonRpcClient) -> dict[str, Any]:
    """Read the Vault ledger object directly (reliable across rippled builds)."""
    from xrpl.models.requests import LedgerEntry

    res = client.request(LedgerEntry(index=vault_id, ledger_index="validated")).result
    return res.get("node") or {}


def vault_liquidity(vault_id: str, client: JsonRpcClient) -> tuple[float, float]:
    """(available, total) RLUSD in the vault.

    `available` is idle liquidity that can be withdrawn right now; the gap
    `total - available` is capital currently lent out and only frees up as loans
    repay or mature. The exit queue services withdrawals against `available`.
    """
    node = vault_node(vault_id, client)
    total = float(node.get("AssetsTotal", "0") or 0)
    available = float(node.get("AssetsAvailable", "0") or 0)
    return available, total


def vault_id_from_result(tx_result: TxResult) -> str | None:
    """Extract the created Vault ledger index from a VaultCreate result."""
    for node in tx_result.raw.get("meta", {}).get("AffectedNodes", []):
        created = node.get("CreatedNode", {})
        if created.get("LedgerEntryType") == "Vault":
            return created.get("LedgerIndex")
    return None
