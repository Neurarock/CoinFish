"""Loans (XLS-66): origination, repayment, and the default path.

LoanSet is co-signed: the borrower signs the loan terms, the broker submits.
xrpl-py provides sign_loan_set_by_counterparty for the borrower's signature.

NOTE: the exact units for principal/fees/interval are confirmed against the
VaultCreate/LoanSet references during M4. Fields below are the verified field
names from xrpl-py 5.0.0; double-check encoding when wiring the live demo.
"""
from __future__ import annotations

from xrpl.clients import JsonRpcClient
from xrpl.models.transactions import LoanManage, LoanPay, LoanSet
from xrpl.wallet import Wallet

from .. import config
from .assets import rlusd_amount
from .broker import _rate_to_ledger
from .client import TxResult, submit

DAY_SECONDS = 86_400


def originate_loan(
    operator: Wallet,
    borrower: Wallet,
    loan_broker_id: str,
    issuer_address: str,
    principal: float,
    interest_rate: float,
    term_days: int,
    client: JsonRpcClient,
) -> TxResult:
    """Create a fixed-term loan. Principal disburses to the borrower on validation.

    The borrower co-signs the terms (counterparty_signature); the broker submits.
    """
    term_days = min(term_days, config.MAX_TERM_DAYS)
    origination_fee = principal * config.ORIGINATION_FEE + config.FIXED_SERVICE_FEE

    tx = LoanSet(
        account=operator.address,                      # loan broker owner submits
        loan_broker_id=loan_broker_id,
        counterparty=borrower.address,                 # the borrower
        principal_requested=rlusd_amount(principal, issuer_address),
        interest_rate=_rate_to_ledger(interest_rate),
        loan_origination_fee=rlusd_amount(origination_fee, issuer_address),
        payment_interval=term_days * DAY_SECONDS,      # single 30-day term
        payment_total=1,
        grace_period=DAY_SECONDS,
    )
    # TODO(M4): attach borrower counterparty_signature via
    #   xrpl.transaction.sign_loan_set_by_counterparty(tx, borrower)
    return submit(tx, operator, client=client)


def repay(
    borrower: Wallet, loan_id: str, issuer_address: str, value: float, client: JsonRpcClient
) -> TxResult:
    """Borrower repays. Use tfLoanFullPayment for a same-session early full repayment."""
    tx = LoanPay(
        account=borrower.address,
        loan_id=loan_id,
        amount=rlusd_amount(value, issuer_address),
    )
    return submit(tx, borrower, client=client)


def impair_or_default(operator: Wallet, loan_id: str, client: JsonRpcClient) -> TxResult:
    """Broker action to impair/default a delinquent loan (drives the first-loss draw)."""
    tx = LoanManage(account=operator.address, loan_id=loan_id)
    return submit(tx, operator, client=client)
