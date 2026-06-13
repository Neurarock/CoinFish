"""Borrower allowlist = Credentials (XLS-70) + Permissioned Domain (XLS-80).

Ported from the elegant reference scripts credentials.reference.js and
permissionedDomains.reference.js into xrpl-py.

Flow:
  1. CoinFish (operator) creates the borrower domain accepting its own
     "CoinFish-Borrower" credential type  -> permissioned_domain_set
  2. CoinFish issues the credential to a vetted borrower                 -> credential_create
  3. Borrower accepts it, becoming a domain member                      -> credential_accept
Only domain members can transact against the private vault / loans.
"""
from __future__ import annotations

from xrpl.clients import JsonRpcClient
from xrpl.models.transactions import (
    CredentialAccept,
    CredentialCreate,
    PermissionedDomainSet,
)
from xrpl.models.transactions.permissioned_domain_set import Credential as AcceptedCredential
from xrpl.utils import str_to_hex
from xrpl.wallet import Wallet

from .client import TxResult, submit

BORROWER_CREDENTIAL = "CoinFish-Borrower"
CREDENTIAL_HEX = str_to_hex(BORROWER_CREDENTIAL)


def create_borrower_domain(operator: Wallet, client: JsonRpcClient) -> TxResult:
    """Create the permissioned domain that accepts CoinFish borrower credentials."""
    tx = PermissionedDomainSet(
        account=operator.address,
        accepted_credentials=[
            AcceptedCredential(issuer=operator.address, credential_type=CREDENTIAL_HEX)
        ],
    )
    return submit(tx, operator, client=client)


def issue_borrower_credential(
    operator: Wallet, borrower_address: str, client: JsonRpcClient
) -> TxResult:
    """CoinFish issues the borrower credential after off-chain KYC passes."""
    tx = CredentialCreate(
        account=operator.address,
        subject=borrower_address,
        credential_type=CREDENTIAL_HEX,
    )
    return submit(tx, operator, client=client)


def accept_borrower_credential(
    borrower: Wallet, operator_address: str, client: JsonRpcClient
) -> TxResult:
    """Borrower accepts the credential, completing onboarding."""
    tx = CredentialAccept(
        account=borrower.address,
        issuer=operator_address,
        credential_type=CREDENTIAL_HEX,
    )
    return submit(tx, borrower, client=client)
