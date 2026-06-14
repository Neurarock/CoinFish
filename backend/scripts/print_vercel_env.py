"""Print the environment variables the deployed backend needs.

`setup.json` is gitignored (it holds Devnet throwaway seeds), so the Vercel
serverless backend can't read it — which is why pool vault/broker IDs come back
empty ("—…") and on-chain actions can't sign. Run this locally and paste the
output into Vercel → Project → Settings → Environment Variables (Production),
or pipe it to a file and `vercel env add` each one.

    python -m backend.scripts.print_vercel_env

The runtime reads every one of these (see backend/runtime.py).
"""
from __future__ import annotations

import json
from pathlib import Path

SETUP = Path("setup.json")


def main() -> None:
    if not SETUP.exists():
        raise SystemExit("setup.json not found — run `python -m backend.scripts.bootstrap_devnet` first.")
    data = json.loads(SETUP.read_text())

    lines: list[str] = []
    issuer_seed = data.get("issuer_seed", "")
    operator_seed = data.get("operator_seed", "")
    lines.append(f"COINFISH_ISSUER_ADDRESS={data.get('issuer_address', '')}")
    lines.append(f"COINFISH_ISSUER_SEED={issuer_seed}")
    lines.append(f"COINFISH_OPERATOR_SEED={operator_seed}")
    lines.append(f"COINFISH_DOMAIN_ID={data.get('domain_id', '')}")

    # Operator classic address (owns vaults + brokers; used for explorer links).
    if operator_seed:
        try:
            from xrpl.wallet import Wallet
            lines.append(f"COINFISH_OPERATOR_ADDRESS={Wallet.from_seed(operator_seed).classic_address}")
        except Exception:
            pass

    for p in data.get("pools", []):
        key = str(p.get("key", "")).upper().replace("-", "_")
        if p.get("vault_id"):
            lines.append(f"COINFISH_POOL_{key}_VAULT_ID={p['vault_id']}")
        if p.get("loan_broker_id"):
            lines.append(f"COINFISH_POOL_{key}_LOAN_BROKER_ID={p['loan_broker_id']}")

    print("\n".join(lines))


if __name__ == "__main__":
    main()
