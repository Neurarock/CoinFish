"""Seed each pool's VAULT with lendable RLUSD so borrowers have liquidity.

Important distinction:
  - First-loss capital  = the operator's cover in the LOAN BROKER (set at
    bootstrap, absorbs default losses). NOT lendable.
  - Vault TVL           = lender deposits in the VAULT. This is what a loan's
    principal is paid out of. Empty until someone deposits.

This script deposits `amount` RLUSD into each pool's (private) vault as the
operator, issuing the operator that pool's credential first so it's a member of
the pool's permissioned domain. Run from the repo root AFTER bootstrap:

    python -m backend.scripts.fund_pools            # 50,000 RLUSD into each pool
    python -m backend.scripts.fund_pools 100000     # custom amount per pool
    python -m backend.scripts.fund_pools 75000 high # only the 'high' pool

Needs the operator seed (setup.json / env) and Devnet access.
"""
from __future__ import annotations

import sys

from xrpl.utils import str_to_hex

from .. import config
from ..runtime import rt
from ..xrpl_service import broker, identity, vault
from ..xrpl_service.client import get_client, wallet_from_seed


def main() -> None:
    amount = float(sys.argv[1]) if len(sys.argv) > 1 else 50_000.0
    only = sys.argv[2] if len(sys.argv) > 2 else None

    if not rt.operator_seed:
        raise SystemExit("operator seed missing — run bootstrap_devnet first / set env vars.")
    client = get_client()
    operator = wallet_from_seed(rt.operator_seed)
    print(f"Operator {operator.address} funding pools with {amount:,.0f} RLUSD each\n")

    for key, pool in rt.pools.items():
        if only and key != only:
            continue
        if not pool.vault_id:
            print(f"pool {key:4}: no vault_id configured, skipping")
            continue

        # 1. Make the operator a member of the pool's permissioned domain by
        #    issuing + accepting that pool's credential (private vault gate).
        cred_hex = str_to_hex(config.pool_credential_type(key))
        iss = identity.issue_credential(operator, operator.address, cred_hex, client)
        if iss.ok:
            identity.accept_credential(operator, operator.address, cred_hex, client)

        # 2. Deposit RLUSD into the vault (this is the lendable TVL).
        res = vault.deposit(operator, pool.vault_id, rt.issuer_address, amount, client)
        if res.ok:
            avail, total = vault.vault_liquidity(pool.vault_id, client)
            cover = broker.cover_available(pool.loan_broker_id, client) if pool.loan_broker_id else 0
            print(f"pool {key:4}: deposited {amount:,.0f}  ->  vault TVL {total:,.0f} "
                  f"(available {avail:,.0f}), first-loss {cover:,.0f}   tx={res.hash}")
        else:
            print(f"pool {key:4}: FAILED — {res.engine_result}")

    print("\nDone. Borrowers can now draw loans up to each pool's available liquidity.")


if __name__ == "__main__":
    main()
