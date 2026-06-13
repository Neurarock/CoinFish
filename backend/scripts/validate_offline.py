"""Offline correctness harness — no network required.

Builds every CoinFish transaction with realistic values, runs xrpl-py's local
validation, and fully exercises the two-party LoanSet signing + binary
round-trip. This catches field/encoding/range/signature bugs before you ever
spend a Devnet faucet drop. Run:  python -m backend.scripts.validate_offline
"""
from __future__ import annotations

from xrpl.models.amounts import IssuedCurrencyAmount
from xrpl.models.currencies import IssuedCurrency
from xrpl.models.transactions import (
    AccountSet, AccountSetAsfFlag, CredentialAccept, CredentialCreate,
    LoanBrokerCoverDeposit, LoanBrokerSet, LoanManage, LoanPay, LoanSet,
    Payment, PermissionedDomainSet, TrustSet, VaultCreate, VaultDeposit,
    VaultWithdraw,
)
from xrpl.models.transactions.deposit_preauth import Credential
from xrpl.models.transactions.loan_manage import LoanManageFlag
from xrpl.models.transactions.vault_create import VaultCreateFlag, WithdrawalPolicy
from xrpl.transaction import sign, sign_loan_set_by_counterparty
from xrpl.utils import str_to_hex
from xrpl.wallet import Wallet

from .. import config
from ..risk_engine import quote_loan
from ..xrpl_service.broker import _rate_to_ledger
from ..xrpl_service.identity import CREDENTIAL_HEX

HEX64 = "A" * 64  # stand-in ledger object id (vault/broker/domain/loan)
results: list[tuple[str, bool, str]] = []


def check(label: str, tx) -> None:
    try:
        tx.validate()
        results.append((label, True, ""))
    except Exception as e:  # noqa: BLE001
        results.append((label, False, str(e)))


def main() -> None:
    issuer = Wallet.create()
    operator = Wallet.create()
    lender = Wallet.create()
    borrower = Wallet.create()
    iss = issuer.address
    amt = lambda v: IssuedCurrencyAmount(currency=config.STABLECOIN_HEX, issuer=iss, value=str(v))

    # --- assets / identity ---
    check("AccountSet(rippling)", AccountSet(account=iss, set_flag=AccountSetAsfFlag.ASF_DEFAULT_RIPPLE))
    check("TrustSet(RLUSD)", TrustSet(account=operator.address,
          limit_amount=IssuedCurrencyAmount(currency=config.STABLECOIN_HEX, issuer=iss, value="1000000000")))
    check("Payment(mint RLUSD)", Payment(account=iss, destination=operator.address, amount=amt(1000000)))
    check("PermissionedDomainSet", PermissionedDomainSet(account=operator.address,
          accepted_credentials=[Credential(issuer=operator.address, credential_type=CREDENTIAL_HEX)]))
    check("CredentialCreate", CredentialCreate(account=operator.address, subject=borrower.address, credential_type=CREDENTIAL_HEX))
    check("CredentialAccept", CredentialAccept(account=borrower.address, issuer=operator.address, credential_type=CREDENTIAL_HEX))

    # --- vault / broker (per pool) ---
    for p in config.POOLS:
        check(f"VaultCreate[{p.key}]", VaultCreate(
            account=operator.address,
            asset=IssuedCurrency(currency=config.STABLECOIN_HEX, issuer=iss),
            data=str_to_hex(p.name), assets_maximum="0",
            withdrawal_policy=WithdrawalPolicy.VAULT_STRATEGY_FIRST_COME_FIRST_SERVE))
        check(f"VaultCreate.private[{p.key}]", VaultCreate(
            account=operator.address,
            asset=IssuedCurrency(currency=config.STABLECOIN_HEX, issuer=iss),
            flags=VaultCreateFlag.TF_VAULT_PRIVATE, domain_id=HEX64,
            data=str_to_hex(p.name), assets_maximum="0",
            withdrawal_policy=WithdrawalPolicy.VAULT_STRATEGY_FIRST_COME_FIRST_SERVE))
        check(f"LoanBrokerSet[{p.key}]", LoanBrokerSet(
            account=operator.address, vault_id=HEX64,
            management_fee_rate=_rate_to_ledger(config.MANAGEMENT_FEE),
            cover_rate_minimum=_rate_to_ledger(p.cover_rate_minimum),
            cover_rate_liquidation=_rate_to_ledger(config.COVER_RATE_LIQUIDATION)))
        check(f"LoanBrokerCoverDeposit[{p.key}]", LoanBrokerCoverDeposit(
            account=operator.address, loan_broker_id=HEX64, amount=amt(50000)))

    # --- lender flow ---
    check("VaultDeposit", VaultDeposit(account=lender.address, vault_id=HEX64, amount=amt(25000)))
    check("VaultWithdraw", VaultWithdraw(account=lender.address, vault_id=HEX64, amount=amt(5000)))

    # --- loan flow ---
    pool = config.POOLS[1]
    q = quote_loan(pool=pool, principal=10000, credit_score=710, fiat_deposit=15000,
                   credit_limit=12000, term_hours=24, pool_drawn=20000, pool_tvl=100000)
    loan = LoanSet(
        account=operator.address, loan_broker_id=HEX64, counterparty=borrower.address,
        principal_requested=str(q.principal), interest_rate=_rate_to_ledger(q.interest_rate),
        loan_origination_fee=str(round(q.origination_fee, 6)),
        payment_interval=24 * 3600, payment_total=1, grace_period=12 * 3600)
    check("LoanSet(unsigned)", loan)
    check("LoanSet(short/default-demo)", LoanSet(
        account=operator.address, loan_broker_id=HEX64, counterparty=borrower.address,
        principal_requested="5000", interest_rate=_rate_to_ledger(0.10),
        loan_origination_fee="25", payment_interval=120, payment_total=1, grace_period=60))
    check("LoanPay", LoanPay(account=borrower.address, loan_id=HEX64, amount=amt(10500)))
    check("LoanManage(impair)", LoanManage(account=operator.address, loan_id=HEX64,
          flags=LoanManageFlag.TF_LOAN_IMPAIR))
    check("LoanManage(default)", LoanManage(account=operator.address, loan_id=HEX64,
          flags=LoanManageFlag.TF_LOAN_DEFAULT))

    # --- two-party LoanSet signing, fully offline ---
    label = "LoanSet co-sign + round-trip"
    try:
        manual = loan.to_dict()
        manual.update(sequence=1, fee="10", last_ledger_sequence=1000, signing_pub_key="")
        unsigned = LoanSet.from_dict(manual)
        broker_signed = sign(unsigned, operator)                      # first party
        co = sign_loan_set_by_counterparty(borrower, broker_signed)   # counterparty
        assert co.tx.txn_signature and co.tx.counterparty_signature, "missing a signature"
        rt = LoanSet.from_blob(co.tx_blob)                            # binary round-trip
        assert rt.counterparty_signature is not None
        results.append((label, True, f"hash={co.hash[:12]}…"))
    except Exception as e:  # noqa: BLE001
        results.append((label, False, str(e)))

    # --- report ---
    print(f"\nInterest quote (balanced pool): {round(q.interest_rate*100,2)}%  approved={q.approved}\n")
    ok = sum(1 for _, p, _ in results if p)
    for label, passed, note in results:
        print(f"  {'PASS' if passed else 'FAIL'}  {label}" + (f"   [{note}]" if note else ""))
    print(f"\n{ok}/{len(results)} transactions valid & signable offline.")


if __name__ == "__main__":
    main()
