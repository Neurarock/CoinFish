"""Live Devnet demo of the exit queue under a bank-run.

Scenario: three lenders fund a pool, most of it gets lent out to a borrower,
then ALL THREE rush for the exit at once. Only the idle slice can be paid
immediately; the rest is parked in a fair FIFO queue and drained as the loan is
repaid (and, in production, as loans mature — bounded to 24h by config).

    python -m backend.scripts.run_exit_demo
"""
from __future__ import annotations

import sys

from .. import config
from ..exit_queue import ExitQueue
from ..risk_engine import quote_loan
from ..xrpl_service import assets, broker, identity, loan, vault
from ..xrpl_service.client import fund_wallet, get_client

POOL = config.POOLS[1]
DEPOSIT = 10_000.0           # each lender supplies this
BORROW = 24_000.0           # borrower draws most of the 30k pool


def must(label, res):
    flag = "OK " if res.ok else "FAIL"
    print(f"  [{flag}] {label}: {res.engine_result}")
    if not res.ok:
        raise RuntimeError(f"{label} failed: {res.engine_result}")
    return res


def show_queue(q: ExitQueue, vault_id: str) -> None:
    avail, total = vault.vault_liquidity(vault_id, get_client())
    print(f"   vault: available={avail} total={total} | queue outstanding={q.outstanding(vault_id)}")
    for r in q.queue(vault_id):
        print(f"     #{r.id} {r.lender[:8]}…  requested={r.amount_requested} "
              f"filled={r.amount_filled} remaining={r.remaining}  [{r.status.value}]  txs={len(r.tx_hashes)}")


def main() -> None:
    c = get_client()
    print("\n=== CoinFish exit-queue (bank-run) demo ===\n")

    # Bootstrap pool ----------------------------------------------------------
    issuer, operator = fund_wallet(c), fund_wallet(c)
    must("enable rippling", assets.enable_rippling(issuer, c))
    must("operator trustline", assets.create_trustline(operator, issuer.address, c))
    must("mint reserve", assets.mint_rlusd(issuer, operator.address, "1000000", c))
    dom = must("borrower domain", identity.create_borrower_domain(operator, c))
    domain_id = next((n["CreatedNode"]["LedgerIndex"] for n in dom.raw["meta"]["AffectedNodes"]
                      if n.get("CreatedNode", {}).get("LedgerEntryType") == "PermissionedDomain"), None)
    v = must("VaultCreate", vault.create_vault(operator, issuer.address, domain_id, POOL.name, c))
    vault_id = vault.vault_id_from_result(v)
    b = must("LoanBrokerSet", broker.create_loan_broker(operator, vault_id, POOL.cover_rate_minimum, c))
    broker_id = broker.loan_broker_id_from_result(b)
    must("first-loss capital", broker.deposit_first_loss_capital(operator, broker_id, issuer.address, "50000", c))
    print(f"   vault_id={vault_id}\n   explorer: {config.EXPLORER}/accounts/{operator.address}")

    # Three lenders supply the pool ------------------------------------------
    print("\n1. Three lenders deposit 10,000 each (TVL 30,000)")
    lenders = {}
    for name in ("alice", "bob", "carol"):
        w = fund_wallet(c)
        must(f"{name} trustline", assets.create_trustline(w, issuer.address, c))
        must(f"mint -> {name}", assets.mint_rlusd(issuer, w.address, str(int(DEPOSIT)), c))
        must(f"{name} VaultDeposit {DEPOSIT}", vault.deposit(w, vault_id, issuer.address, str(DEPOSIT), c))
        lenders[w.address] = (name, w)

    # Borrower draws most of the liquidity -----------------------------------
    print("\n2. A borrower draws 24,000 — now only ~6,000 is idle")
    borrower = fund_wallet(c)
    must("borrower trustline", assets.create_trustline(borrower, issuer.address, c))
    must("issue credential", identity.issue_borrower_credential(operator, borrower.address, c))
    must("accept credential", identity.accept_borrower_credential(borrower, operator.address, c))
    q = quote_loan(pool=POOL, principal=BORROW, credit_score=720, fiat_deposit=30000,
                   credit_limit=25000, term_hours=24, pool_drawn=0, pool_tvl=30000)
    dres = must("LoanSet disburse 24,000 (24h max term)", loan.originate_loan(
        operator, borrower, broker_id, q.principal, q.interest_rate, q.term_hours, c))
    loan_id = loan.loan_id_from_result(dres)
    avail, total = vault.vault_liquidity(vault_id, c)
    print(f"   vault: available={avail} total={total} (lent out={round(total-avail,6)})")

    # Build the live exit queue ----------------------------------------------
    def available_fn(vid: str) -> float:
        # Report a hair less than the headline idle balance. When a vault has
        # accrued yield (share price > 1), redeeming shares for the *exact*
        # AssetsAvailable rounds just past it and the ledger rejects the
        # VaultWithdraw (tecINSUFFICIENT_FUNDS); a tiny reserve absorbs that.
        # It costs nothing — the drain phase always has yield headroom, so every
        # lender is still filled in full.
        avail = vault.vault_liquidity(vid, c)[0]
        return max(0.0, avail - max(0.01, avail * 1e-5))

    def withdraw_fn(vid: str, lender_addr: str, amount: float) -> str:
        _, wallet = lenders[lender_addr]
        res = vault.withdraw(wallet, vid, issuer.address, amount, c)
        if not res.ok:
            raise RuntimeError(f"VaultWithdraw {amount} for {lender_addr} -> {res.engine_result}")
        return res.hash

    queue = ExitQueue(available_fn, withdraw_fn)

    # The rush: all three request their full 10,000 back at once -------------
    print("\n3. RUSH: all three lenders request their full 10,000 back at once")
    for addr, (name, _) in lenders.items():
        req = queue.request_exit(vault_id, addr, DEPOSIT)
        print(f"   {name} requested {DEPOSIT} -> filled {req.amount_filled}, status={req.status.value}")
    print("\n   Queue after the rush (only idle liquidity could be paid):")
    show_queue(queue, vault_id)

    # Liquidity returns: borrower repays in full (or matures within 24h) ------
    print("\n4. Borrower repays in full -> liquidity returns, queue drains")
    must("mint repay buffer -> borrower", assets.mint_rlusd(issuer, borrower.address, "1000", c))
    owed = loan.loan_outstanding(loan_id, c)
    print(f"   borrower owes {owed}; repaying in full")
    must(f"LoanPay (close {loan_id[:8]}…)", loan.repay_full(borrower, loan_id, issuer.address, c))

    drained = queue.process(vault_id)
    print(f"   processed {len(drained)} fills after repayment")
    show_queue(queue, vault_id)

    ok = queue.outstanding(vault_id) == 0
    print(f"\n{'All lenders fully exited.' if ok else 'Queue still draining (would clear as more loans mature).'}")
    print(f"Explorer (operator): {config.EXPLORER}/accounts/{operator.address}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        print(f"\nERROR: {e!r}", file=sys.stderr)
        print("If this is a network error, confirm you're online (Devnet is internet-only).", file=sys.stderr)
        sys.exit(1)
