"""One-shot Devnet bootstrap for CoinFish.

Creates the issuer + operator wallets, mints RLUSD, sets up the borrower
permissioned domain, and stands up the 3 pools (vault + loan broker + first-loss
capital). Prints all wallet seeds + the explorer links.

Run from the CoinFish/ root:
    python -m backend.scripts.bootstrap_devnet

This is intentionally idempotent-ish for hackathon use: re-running creates fresh
accounts (Devnet faucet), so capture the printed seeds into your .env.
"""
from __future__ import annotations

import json

from .. import config
from ..xrpl_service import assets, broker, identity, vault
from ..xrpl_service.client import fund_wallet, get_client


def main() -> None:
    client = get_client()
    print("=== CoinFish Devnet bootstrap ===\n")

    # 1. Core wallets
    issuer = fund_wallet(client)
    operator = fund_wallet(client)
    print(f"Issuer  : {issuer.address}  seed={issuer.seed}")
    print(f"Operator: {operator.address}  seed={operator.seed}\n")

    # 2. RLUSD stand-in stablecoin
    assets.enable_rippling(issuer, client)
    assets.create_trustline(operator, issuer.address, client)
    assets.mint_rlusd(issuer, operator.address, "1000000", client)
    print("Minted 1,000,000 RLUSD to operator (reserve + first-loss capital)\n")

    # 3. Borrower permissioned domain
    dom = identity.create_borrower_domain(operator, client)
    print(f"Borrower domain created: {dom.explorer_url}\n")
    # domain_id is read from the created PermissionedDomain ledger entry:
    domain_id = _created_index(dom.raw, "PermissionedDomain")

    # 4. Three pools
    pools_out = []
    for p in config.POOLS:
        v = vault.create_vault(operator, issuer.address, domain_id, p.name, client)
        vault_id = vault.vault_id_from_result(v)
        b = broker.create_loan_broker(operator, vault_id, p.cover_rate_minimum, client)
        broker_id = broker.loan_broker_id_from_result(b)
        broker.deposit_first_loss_capital(operator, broker_id, issuer.address, "50000", client)
        pools_out.append({"key": p.key, "vault_id": vault_id, "loan_broker_id": broker_id})
        print(f"Pool '{p.key}': vault={vault_id} broker={broker_id}")

    out = {
        "issuer_seed": issuer.seed,
        "issuer_address": issuer.address,
        "operator_seed": operator.seed,
        "operator_address": operator.address,
        "domain_id": domain_id,
        "pools": pools_out,
    }
    print("\n=== Save this to .env / setup.json ===")
    print(json.dumps(out, indent=2))


def _created_index(raw: dict, entry_type: str) -> str | None:
    for node in raw.get("meta", {}).get("AffectedNodes", []):
        created = node.get("CreatedNode", {})
        if created.get("LedgerEntryType") == entry_type:
            return created.get("LedgerIndex")
    return None


if __name__ == "__main__":
    main()
