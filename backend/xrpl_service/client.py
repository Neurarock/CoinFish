"""Devnet client + a single reliable submit helper used by every module."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from xrpl.clients import JsonRpcClient
from xrpl.transaction import autofill_and_sign, submit_and_wait
from xrpl.wallet import Wallet, generate_faucet_wallet

from .. import config


def get_client() -> JsonRpcClient:
    return JsonRpcClient(config.DEVNET_JSON_RPC)


def fund_wallet(client: JsonRpcClient | None = None) -> Wallet:
    """Create + fund a fresh Devnet wallet from the faucet."""
    client = client or get_client()
    return generate_faucet_wallet(client, debug=True)


@dataclass
class TxResult:
    ok: bool
    hash: str
    engine_result: str
    raw: dict[str, Any]

    @property
    def explorer_url(self) -> str:
        return f"{config.EXPLORER}/transactions/{self.hash}"


def submit(tx, *wallets: Wallet, client: JsonRpcClient | None = None) -> TxResult:
    """Sign (single or multi-sig) and submit a transaction, waiting for validation.

    Pass one wallet for normal transactions. For LoanSet the broker signs and
    submits while the borrower's signature travels in the `counterparty_signature`
    field, so still a single submitting wallet here.
    """
    client = client or get_client()
    submitter = wallets[0]
    response = submit_and_wait(tx, client, submitter)
    result = response.result
    meta = result.get("meta", {})
    engine = meta.get("TransactionResult", "") if isinstance(meta, dict) else ""
    return TxResult(
        ok=response.is_successful(),
        hash=result.get("hash", ""),
        engine_result=engine,
        raw=result,
    )


def wallet_from_seed(seed: str) -> Wallet:
    return Wallet.from_seed(seed)
