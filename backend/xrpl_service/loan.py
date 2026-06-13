"""Loans (XLS-66): origination, repayment, and the default path.

LoanSet is a TWO-signature transaction:
  1. the broker (Account = operator) signs first (normal autofill + sign), then
  2. the borrower (counterparty) adds a CounterpartySignature via
     sign_loan_set_by_counterparty, then
  3. the fully-signed blob is submitted.

Amounts (principal/fees) are plain numeric strings in the vault asset's units;
rates are integers in 1/10th-basis-points (0.10 == 10%  -> 10000), matching the
LoanSet validation bounds (0..100000 == 0..100%).
"""
from __future__ import annotations

from xrpl.clients import JsonRpcClient
from xrpl.models.requests import LedgerEntry
from xrpl.models.transactions import LoanManage, LoanPay, LoanSet
from xrpl.models.transactions.loan_manage import LoanManageFlag
from xrpl.transaction import autofill_and_sign, sign_loan_set_by_counterparty
from xrpl.wallet import Wallet

from .. import config
from .assets import rlusd_amount
from .broker import _rate_to_ledger
from .client import TxResult, submit, submit_signed


def term_seconds(term_hours: int) -> int:
    """Loan term in seconds: clamp to [MIN_TERM_SECONDS, MAX_TERM_HOURS]."""
    secs = int(term_hours * config.HOUR_SECONDS)
    cap = config.MAX_TERM_HOURS * config.HOUR_SECONDS
    return max(config.MIN_TERM_SECONDS, min(secs, cap))


def build_loan_set(
    operator_address: str,
    borrower_address: str,
    loan_broker_id: str,
    principal: float,
    interest_rate: float,
    term_hours: int,
    *,
    payment_interval: int | None = None,
    grace_period: int | None = None,
) -> LoanSet:
    """Construct the unsigned LoanSet (broker = Account, borrower = counterparty).

    `term_hours` is the single fixed term (<= 24h). `payment_interval` /
    `grace_period` can be overridden in seconds for the default demo (a short
    interval lets a loan go past-due fast). grace_period must be > 0 and < the
    payment interval, else the ledger rejects the LoanSet (temINVALID).
    """
    interval = payment_interval if payment_interval is not None else term_seconds(term_hours)
    grace = grace_period if grace_period is not None else max(1, interval // 2)
    origination_fee = principal * config.ORIGINATION_FEE + config.FIXED_SERVICE_FEE
    return LoanSet(
        account=operator_address,                  # loan broker owner submits + signs first
        loan_broker_id=loan_broker_id,
        counterparty=borrower_address,             # the borrower co-signs
        principal_requested=str(principal),        # numeric string in vault-asset units
        interest_rate=_rate_to_ledger(interest_rate),
        loan_origination_fee=str(round(origination_fee, 6)),
        payment_interval=interval,                 # single fixed term
        payment_total=1,
        grace_period=grace,
    )


def originate_loan(
    operator: Wallet,
    borrower: Wallet,
    loan_broker_id: str,
    principal: float,
    interest_rate: float,
    term_hours: int,
    client: JsonRpcClient,
    *,
    payment_interval: int | None = None,
    grace_period: int | None = None,
) -> TxResult:
    """Originate a loan: broker signs, borrower co-signs, submit. Funds disburse on validation."""
    tx = build_loan_set(
        operator.address, borrower.address, loan_broker_id, principal, interest_rate,
        term_hours, payment_interval=payment_interval, grace_period=grace_period,
    )
    # 1. broker signs first (autofills Sequence/Fee/LastLedgerSequence)
    broker_signed = autofill_and_sign(tx, client, operator)
    # 2. borrower adds the counterparty signature
    result = sign_loan_set_by_counterparty(borrower, broker_signed)
    # 3. submit the fully co-signed transaction
    return submit_signed(result.tx, client=client)


def loan_id_from_result(tx_result: TxResult) -> str | None:
    """Extract the created Loan ledger index from a LoanSet result."""
    for node in tx_result.raw.get("meta", {}).get("AffectedNodes", []):
        created = node.get("CreatedNode", {})
        if created.get("LedgerEntryType") == "Loan":
            return created.get("LedgerIndex")
    return None


def _loan_node(loan_id: str, client: JsonRpcClient) -> dict | None:
    """Read the live Loan ledger object, or None once it has been repaid/closed."""
    res = client.request(LedgerEntry(index=loan_id, ledger_index="validated")).result
    return res.get("node")


def loan_outstanding(loan_id: str, client: JsonRpcClient) -> str:
    """Current TotalValueOutstanding (principal + interest + fees) as a string.

    Returned verbatim from the ledger so it stays within XRPL's 15-significant-
    digit issued-currency precision; pass it straight into a LoanPay amount.
    """
    node = _loan_node(loan_id, client) or {}
    return str(node.get("TotalValueOutstanding", "0"))


def loan_is_repaid(loan_id: str, client: JsonRpcClient) -> bool:
    """True once the loan carries no outstanding balance.

    Full repayment doesn't delete the Loan object — it strips the debt fields
    (PrincipalOutstanding / PaymentRemaining), leaving the entry as a record.
    """
    node = _loan_node(loan_id, client)
    if node is None:
        return True  # object reaped entirely
    principal = float(node.get("PrincipalOutstanding") or 0)
    remaining = int(node.get("PaymentRemaining") or 0)
    return principal == 0 and remaining == 0


def repay(
    borrower: Wallet, loan_id: str, issuer_address: str, value: float | str, client: JsonRpcClient
) -> TxResult:
    """Make one scheduled LoanPay of `value` RLUSD.

    For CoinFish's single-payment fixed-term loans, paying the full
    TotalValueOutstanding settles the sole scheduled payment and closes the loan
    (see repay_full). Note: tfLoanFullPayment is *not* used — it is rejected
    (tecKILLED) on loans that carry no early-close terms.
    """
    tx = LoanPay(
        account=borrower.address,
        loan_id=loan_id,
        amount=rlusd_amount(value, issuer_address),
    )
    return submit(tx, borrower, client=client)


def repay_full(
    borrower: Wallet, loan_id: str, issuer_address: str, client: JsonRpcClient
) -> TxResult:
    """Repay the entire outstanding balance, closing the loan."""
    return repay(borrower, loan_id, issuer_address, loan_outstanding(loan_id, client), client)


def impair(operator: Wallet, loan_id: str, client: JsonRpcClient) -> TxResult:
    """Flag a delinquent loan as impaired (tfLoanImpair).

    Impairing writes the expected loss down against the vault immediately and
    brings the loan's next payment due date forward by one interval, so it can
    be defaulted as soon as the grace period lapses.
    """
    tx = LoanManage(account=operator.address, loan_id=loan_id, flags=LoanManageFlag.TF_LOAN_IMPAIR)
    return submit(tx, operator, client=client)


def default_loan(operator: Wallet, loan_id: str, client: JsonRpcClient) -> TxResult:
    """Default a past-due loan (tfLoanDefault): draws first-loss cover, then
    socialises any remaining loss across the vault's shares. Only valid once the
    payment is past its due date + grace period."""
    tx = LoanManage(account=operator.address, loan_id=loan_id, flags=LoanManageFlag.TF_LOAN_DEFAULT)
    return submit(tx, operator, client=client)


def unimpair(operator: Wallet, loan_id: str, client: JsonRpcClient) -> TxResult:
    """Reverse an impairment (tfLoanUnimpair), e.g. after a late payment lands."""
    tx = LoanManage(account=operator.address, loan_id=loan_id, flags=LoanManageFlag.TF_LOAN_UNIMPAIR)
    return submit(tx, operator, client=client)


def loan_status(loan_id: str, client: JsonRpcClient) -> dict:
    """Snapshot a loan's on-chain state for display: outstanding, flags, due date."""
    node = _loan_node(loan_id, client) or {}
    flags = int(node.get("Flags", 0) or 0)
    return {
        "exists": bool(node),
        "principal_outstanding": node.get("PrincipalOutstanding"),
        "total_outstanding": node.get("TotalValueOutstanding"),
        "next_payment_due": node.get("NextPaymentDueDate"),
        "impaired": bool(flags & int(LoanManageFlag.TF_LOAN_IMPAIR)),
        "defaulted": bool(flags & int(LoanManageFlag.TF_LOAN_DEFAULT)),
    }
