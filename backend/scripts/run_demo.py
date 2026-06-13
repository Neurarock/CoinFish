"""End-to-end CoinFish demo on Devnet — the live hackathon run.

Walks the full A->G lifecycle from SPEC.md against real Devnet ledgers, printing
a tesSUCCESS hash + explorer link for every on-chain step. Needs open internet
(the lending amendment is Devnet-only). Construction + signing of every tx here
is already verified offline by validate_offline.py.

    python -m backend.scripts.run_demo
"""
from __future__ import annotations

import sys

from .. import config
from ..risk_engine import quote_loan
from ..xrpl_service import assets, broker, identity, loan, vault
from ..xrpl_service.client import TxResult, fund_wallet, get_client

POOL = config.POOLS[1]  # Balanced pool for the demo


def step(label: str, res: TxResult) -> TxResult:
    flag = "OK " if res.ok else "FAIL"
    print(f"  [{flag}] {label}: {res.engine_result}  {res.explorer_url if res.hash else ''}")
    if not res.ok:
        print(f"        -> raw: {res.engine_result}")
    return res


def main() -> None:
    c = get_client()
    print("\n=== CoinFish live Devnet demo ===\n")

    # A. Bootstrap core wallets + RLUSD ----------------------------------------
    print("A. Bootstrap")
    issuer, operator = fund_wallet(c), fund_wallet(c)
    print(f"   issuer={issuer.address}  operator={operator.address}")
    step("enable rippling", assets.enable_rippling(issuer, c))
    step("operator trustline", assets.create_trustline(operator, issuer.address, c))
    step("mint 1,000,000 RLUSD -> operator", assets.mint_rlusd(issuer, operator.address, "1000000", c))

    # Borrower permissioned domain
    dom = step("create borrower domain", identity.create_borrower_domain(operator, c))
    domain_id = _created(dom, "PermissionedDomain")

    # One pool: vault + broker + first-loss capital
    v = step(f"VaultCreate [{POOL.key}]", vault.create_vault(operator, issuer.address, domain_id, POOL.name, c))
    vault_id = vault.vault_id_from_result(v)
    b = step("LoanBrokerSet", broker.create_loan_broker(operator, vault_id, POOL.cover_rate_minimum, c))
    broker_id = broker.loan_broker_id_from_result(b)
    step("first-loss capital (50,000)", broker.deposit_first_loss_capital(operator, broker_id, issuer.address, "50000", c))

    # B. Lender supplies the pool ----------------------------------------------
    print("\nB. Lender deposits")
    lender = fund_wallet(c)
    step("lender trustline", assets.create_trustline(lender, issuer.address, c))
    step("mint 30,000 RLUSD -> lender", assets.mint_rlusd(issuer, lender.address, "30000", c))
    step("VaultDeposit 25,000", vault.deposit(lender, vault_id, issuer.address, "25000", c))

    # C. Borrower onboarding (off-chain KYC -> on-chain credential) -------------
    print("\nC. Borrower onboarding")
    borrower = fund_wallet(c)
    step("borrower trustline", assets.create_trustline(borrower, issuer.address, c))
    fiat_deposit, credit_limit, credit_score = 15000.0, 12000.0, 710   # off-chain policy
    print(f"   off-chain: fiat_deposit={fiat_deposit} credit_limit={credit_limit} score={credit_score}")
    step("issue borrower credential", identity.issue_borrower_credential(operator, borrower.address, c))
    step("borrower accepts credential", identity.accept_borrower_credential(borrower, operator.address, c))

    # D. Instant loan ----------------------------------------------------------
    print("\nD. Instant loan")
    q = quote_loan(pool=POOL, principal=10000, credit_score=credit_score,
                   fiat_deposit=fiat_deposit, credit_limit=credit_limit, term_days=30,
                   pool_drawn=0, pool_tvl=25000)
    print(f"   quote: principal={q.principal} rate={round(q.interest_rate*100,2)}% fee={q.origination_fee} approved={q.approved}")
    loan_id = None
    if q.approved:
        loan_res = step("LoanSet (co-signed) disburse", loan.originate_loan(
            operator, borrower, broker_id, q.principal, q.interest_rate, q.term_days, c))
        loan_id = loan.loan_id_from_result(loan_res)
        print(f"   loan id: {loan_id}")
        print(f"   borrower RLUSD balance: {assets.rlusd_balance(borrower.address, issuer.address, c)}")

    # E. Repayment (full payoff; mint a little to cover interest + fee) ---------
    print("\nE. Repayment")
    if loan_id:
        step("mint interest buffer -> borrower", assets.mint_rlusd(issuer, borrower.address, "1500", c))
        owed = loan.loan_outstanding(loan_id, c)
        print(f"   full balance outstanding: {owed}")
        step(f"LoanPay {owed} (close loan)", loan.repay_full(borrower, loan_id, issuer.address, c))
        print(f"   loan fully repaid (no outstanding balance): {loan.loan_is_repaid(loan_id, c)}")

    # G. Lender exit -----------------------------------------------------------
    print("\nG. Lender withdraws")
    step("VaultWithdraw 5,000", vault.withdraw(lender, vault_id, issuer.address, "5000", c))

    print("\nDone. See SPEC.md §6 for the default/recovery path (LoanManage).")
    print(f"Explorer: {config.EXPLORER}/accounts/{operator.address}")


def _created(res: TxResult, entry_type: str) -> str | None:
    for node in res.raw.get("meta", {}).get("AffectedNodes", []):
        cn = node.get("CreatedNode", {})
        if cn.get("LedgerEntryType") == entry_type:
            return cn.get("LedgerIndex")
    return None


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        print(f"\nERROR: {e!r}", file=sys.stderr)
        print("If this is a network error, confirm you're online (Devnet is internet-only).", file=sys.stderr)
        sys.exit(1)
