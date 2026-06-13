"""Demo-mode receipt endpoint for off-chain local actions.

In live-chain mode users should verify transactions on XRPL Explorer. In the
default local demo mode, transaction hashes are synthetic, so this endpoint gives
the UI an honest receipt target instead of linking to a missing XRPL tx.
"""
from __future__ import annotations

from fastapi import APIRouter

from ..runtime import LIVE_CHAIN

router = APIRouter(prefix="/receipts", tags=["receipts"])


@router.get("/{receipt_id}")
def receipt(receipt_id: str) -> dict:
    return {
        "receipt_id": receipt_id,
        "mode": "xrpl-devnet" if LIVE_CHAIN else "local-demo",
        "on_chain": LIVE_CHAIN,
        "message": (
            "This id corresponds to an XRPL Devnet transaction."
            if LIVE_CHAIN else
            "This is a local CoinFish demo receipt. No XRPL transaction was submitted."
        ),
    }
