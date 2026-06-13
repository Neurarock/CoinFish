# CoinFish — Time-Critical, Off-Chain-Collateralised Lending on the XRPL

**Hackathon track:** Ripple / XRPL core (no EVM)
**Network:** XRPL **Devnet** (the only network where the lending amendment is live)
**Stack:** Python everywhere on the backend — FastAPI + `xrpl-py` 5.0.0 — with a React dashboard for the demo.
**Status:** MVP spec, v1. Devnet only, no production concerns.

---

## 1. The one-paragraph pitch

Businesses on TradFi rails are *fiat-rich but crypto-poor*. When they need on-chain liquidity **right now** — e.g. a one-second arbitrage window — converting fiat to crypto through a bank is far too slow, and existing DeFi lending only lets them borrow against **on-chain** collateral they don't have. CoinFish is a centralised, KYC'd loan broker that onboards borrowers in TradFi (due diligence + a fiat cash deposit held by us = **off-chain collateral**, secured by sovereign law). Against that off-chain deposit we let them draw an **instant, uncollateralised on-chain loan** on the XRPL, settling in stablecoin in seconds. Lenders supply stablecoin into risk-tiered pools and earn yield; their principal is always backstopped by real fiat plus a first-loss buffer. CoinFish earns a cut of the yield and a service fee per loan.

---

## 2. The single most important design fact

Two XRPL features we need live on **different networks**:

| Feature | Standard | Live on |
|---|---|---|
| Lending Protocol (Vaults, Loan Brokers, Loans, first-loss capital) | XLS-66 / XLS-65 | **Devnet only** (amendment still in validator voting) |
| Permissioned Domains | XLS-80 | Devnet (+ Testnet) |
| Credentials | XLS-70 | Devnet (+ Testnet) |
| **Real RLUSD** (issuer `rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV`) | — | **Testnet + Mainnet only — NOT Devnet** |

**Consequence:** we must build on Devnet, and real RLUSD is therefore unavailable. We fake it the cheapest, most readable way: **CoinFish issues its own trustline IOU with the currency code `RLUSD`** from a dedicated issuer wallet on Devnet. In the explorer and in balances it literally reads "RLUSD", and it reuses the starter repo's existing `trustline.py` / `rlusd_transaction.py` almost verbatim. Everywhere below, "RLUSD" means *our Devnet stand-in stablecoin*.

> We confirmed `xrpl-py` 5.0.0 ships **typed Python models for every transaction we need** — `VaultCreate/Deposit/Withdraw/Set/Delete/Clawback`, `LoanBrokerSet`, `LoanBrokerCoverDeposit/Withdraw/Clawback`, `LoanSet`, `LoanPay`, `LoanManage`, `LoanDelete`, `PermissionedDomainSet`, `CredentialCreate/Accept/Delete`. **The whole chain layer stays in Python.** No JavaScript required for the protocol.

---

## 3. How the business model maps onto XRPL primitives

CoinFish's economics map almost one-to-one onto the XLS-66 lending protocol. This is the heart of the project.

| CoinFish concept | XRPL primitive | Notes |
|---|---|---|
| **CoinFish** (the platform / vault owner / loan broker) | `LoanBroker` object + Vault owner account + Credential issuer + Domain owner | One CoinFish operator account wears all four hats. |
| **A lending pool** (a risk/return profile) | One **Single Asset Vault** (XLS-65) + its **LoanBroker** | We run several. Each pool = one vault + one broker with its own first-loss % and target rate. |
| **Lender** supplying stablecoin to a pool | **Depositor** → `VaultDeposit` | Receives vault **shares** (an MPT) representing their pro-rata claim + accrued yield. |
| **Lender's yield** | Interest paid into the vault, minus management fee | Shares appreciate; lender redeems via `VaultWithdraw`. |
| **Borrower** (onboarded business) | Loan recipient on a co-signed `LoanSet` | Must hold a CoinFish credential and be in the permissioned domain. |
| **Off-chain fiat collateral** | **Nothing on-chain** — a row in CoinFish's DB | The trust anchor is sovereign law + our custody, not a ledger object. This is the whole point. |
| **Credit limit / LTV** | Off-chain policy in CoinFish backend | Gates whether we'll co-sign a `LoanSet` and for how much. |
| **"10% flexibility" / first-loss tranche** | `LoanBrokerCoverDeposit`, `CoverRateMinimum = 0.10` | CoinFish deposits first-loss capital; covers a slice of defaults so lenders are protected. |
| **Borrower allowlist (KYC'd only)** | **Permissioned Domain** (XLS-80) gated by **Credentials** (XLS-70) | CoinFish issues a `CoinFish-Borrower` credential; private vault + domain restrict who can transact. |
| **CoinFish's 3% cut of lending yield** | **Management Fee** (% of interest, paid by depositors) | Configured on the `LoanBroker`. |
| **CoinFish's 0.5% service charge + fixed fee to borrower** | **Loan Origination Fee** (from principal) + **Loan Service Fee** (per payment) | Configured on the `LoanBroker`. |
| **Instant settlement to the borrower** | `LoanSet` disburses principal to the borrower's account in one validated ledger (~3–4s) | This is the "fast" that TradFi can't do. |
| **Minimum term, expensive to keep short** | Loan term + interest-rate engine | Protocol loans are **fixed-term 30–180 days**; see §6 for how "min term, no max" maps. |
| **Undercollateralised vs safer pools** | Pools with **lower vs higher `CoverRateMinimum`** and correspondingly higher/lower target APR | Lenders pick their risk/return tier. |
| **Default & recovery** | `LoanManage` (impair) → default → first-loss capital draw; off-chain fiat recovery | On-chain loss socialised to vault after cover is exhausted; fiat clawed back off-chain. |

---

## 4. The off-chain / on-chain boundary (the core insight)

```
                         OFF-CHAIN (CoinFish, sovereign-law trust)        |   ON-CHAIN (XRPL Devnet)
  ----------------------------------------------------------------------- | -----------------------------------------
  Borrower KYC & due diligence            (CoinFish DB)                    |   CredentialCreate  -> borrower
  Fiat cash deposit = collateral          (CoinFish ledger row)           |   (no on-chain object — by design)
  Credit limit / LTV / interest engine    (Python service)                |   sets LoanSet.InterestRate, principal
  Decision to lend                        (CoinFish co-signs)             |   LoanSet (broker + borrower)  -> disburse
  ----------------------------------------------------------------------- | -----------------------------------------
  Lender onboarding                       (optional KYC)                  |   VaultDeposit / VaultWithdraw
  CoinFish first-loss commitment          (capital we put up)             |   LoanBrokerCoverDeposit
```

The borrower's **fiat deposit never touches the chain.** The chain only ever sees stablecoin moving from pool → borrower and back, plus the loan bookkeeping. That separation is what lets a fiat-rich/crypto-poor business borrow on-chain instantly.

---

## 5. System architecture (microservices, all Python backend)

```
                ┌─────────────────────────────────────────────┐
                │  React dashboard (Vite + Tailwind)           │
                │  • Borrower view: request loan, repay        │
                │  • Lender view: browse pools, deposit, yield │
                │  • CoinFish admin: onboard, fund pools, risk │
                └───────────────┬─────────────────────────────┘
                                │ REST/JSON
                ┌───────────────▼─────────────────────────────┐
                │  FastAPI backend  (Python)                   │
                │  ├─ routers: borrowers / lenders / pools /   │
                │  │            loans / admin                  │
                │  ├─ services:                                │
                │  │    • xrpl_service  (xrpl-py, all tx)      │
                │  │    • risk_engine   (rate & LTV calc)      │
                │  │    • onboarding    (KYC + fiat ledger)    │
                │  └─ db: SQLite (off-chain state)             │
                └───────────────┬─────────────────────────────┘
                                │ JSON-RPC / WebSocket
                ┌───────────────▼─────────────────────────────┐
                │  XRPL Devnet  (wss://s.devnet.rippletest.net)│
                │  Vaults · LoanBrokers · Loans · Credentials  │
                │  Permissioned Domains · RLUSD-IOU issuer     │
                └─────────────────────────────────────────────┘
```

**Why this shape:** it's the microservice split you already know — a FastAPI service owning all chain interaction and off-chain state, and a thin frontend. You can work almost entirely in `xrpl_service.py` and `risk_engine.py`; I'll own the React layer so it looks sharp for judges.

### Repo layout (target after pruning)

```
CoinFish/
├─ backend/
│  ├─ main.py                 # FastAPI app
│  ├─ config.py               # network, issuer + operator seeds, fee params
│  ├─ db.py                   # SQLite models (SQLModel)
│  ├─ xrpl_service/
│  │   ├─ client.py           # Devnet client, submit_and_wait helpers
│  │   ├─ assets.py           # RLUSD IOU issue + trustlines  (from trustline.py)
│  │   ├─ identity.py         # CredentialCreate/Accept, PermissionedDomainSet
│  │   ├─ vault.py            # VaultCreate/Deposit/Withdraw + vault_info
│  │   ├─ broker.py           # LoanBrokerSet + LoanBrokerCoverDeposit
│  │   └─ loan.py             # LoanSet / LoanPay / LoanManage / LoanDelete
│  ├─ risk_engine.py          # interest rate + LTV/credit-limit logic
│  ├─ routers/                # borrowers, lenders, pools, loans, admin
│  └─ scripts/
│      └─ bootstrap_devnet.py # one-shot: fund accounts, issue RLUSD, create domain + pools
├─ frontend/                  # React (Vite + Tailwind) — I own this
├─ SPEC.md                    # this file
└─ README.md
```

---

## 6. The lifecycle, end to end (this is also the demo script)

Everything below runs **for real on Devnet** — no faked transactions. Each step prints a `tesSUCCESS` tx hash you can open in the Devnet explorer.

**A. Bootstrap (one-time, `bootstrap_devnet.py`)**
1. Fund the **CoinFish operator** and **RLUSD issuer** wallets from the Devnet faucet.
2. Issuer enables rippling; operator sets a trustline and we **mint RLUSD** to the operator (our reserve / first-loss capital).
3. `PermissionedDomainSet` → create the **CoinFish borrower domain**, accepting the `CoinFish-Borrower` credential type.
4. Create **2–3 pools**: each = `VaultCreate` (private, RLUSD asset, domain-gated) + `LoanBrokerSet` (management fee 3%, origination fee 0.5% + fixed, `CoverRateMinimum` per tier).
5. `LoanBrokerCoverDeposit` → CoinFish posts **first-loss capital** (10% tier, etc.).

**B. Lender supplies a pool**
6. Lender wallet gets RLUSD + trustline, then `VaultDeposit` → receives vault **shares**. UI shows pool TVL, target APR, and CoinFish's committed first-loss capital.

**C. Borrower onboarding (off-chain → on-chain)**
7. CoinFish runs (mock) KYC + records the **fiat deposit** and computes a **credit limit / LTV** (off-chain, in DB).
8. `CredentialCreate` (CoinFish → borrower) then borrower `CredentialAccept` → borrower is now inside the permissioned domain (the allowlist).

**D. Instant loan (the money shot)**
9. Borrower requests `X` RLUSD. `risk_engine` checks LTV vs fiat collateral + credit limit, computes the **interest rate** from credit score, term, pool, and utilisation.
10. `LoanSet`, co-signed by broker + borrower → principal lands in the borrower's wallet in **~3–4 seconds**. Origination fee skimmed to CoinFish. Demo highlights the wall-clock latency vs a bank wire.

**E. Repayment (happy path)**
11. Borrower repays via `LoanPay`; using the `tfLoanFullPayment` flag we can do a **full early repayment in the same session** (no need to wait 30 days). Interest splits: lender yield (vault) + CoinFish management fee. Borrower's fiat deposit unlocks for withdrawal.

**F. Default (risk path, shows why lenders are safe)**
12. Second borrower misses payment → `LoanManage` impair → default. **First-loss capital covers its slice**; the rest is socialised across vault shares; CoinFish initiates **off-chain fiat recovery** against the deposit. UI shows lender principal protected up to the cover, exactly per the XLS-66 first-loss maths.

**G. Lender exits**
13. `VaultWithdraw` → lender redeems shares for principal + net yield.

This A→G path is the live, on-chain demo. Steps D, E, F are the three "wow" moments.

---

## 7. Economics & the interest-rate engine

**Fee wiring (set once on each `LoanBroker`):**
- Management Fee = **3%** of interest → CoinFish's cut of lender yield.
- Loan Origination Fee = **0.5%** of principal + a fixed RLUSD fee → CoinFish's borrower charge.
- Loan Service Fee = small per-payment fee → CoinFish.
- `CoverRateMinimum` = first-loss buffer per pool (e.g. 10% conservative, lower for the high-yield pool).

**Rate engine (`risk_engine.py`, off-chain, fully in our control):** the borrower's `InterestRate` on `LoanSet` is a function of
```
rate = base(pool)                       # pool's risk tier sets the floor
     + credit_spread(credit_score)      # TradFi score → spread
     + ltv_spread(loan / fiat_deposit)  # higher utilisation of collateral → higher rate
     + utilisation_spread(pool)         # pool drawn-down → higher rate
     − term_discount(min_term)          # longer committed term → cheaper
```
This encodes your "longer minimum term ⇒ lower rate, so a short loan kept open is very expensive" rule.

**On "minimum term, no maximum":** XLS-66 loans are **fixed-term (30–180 days)**, not open-ended. We model "no max / borrow indefinitely" as **roll-over**: at maturity, if LTV is still within limit, CoinFish re-originates a new loan. The economic incentive (short rollovers are pricey) lives in `term_discount`. For the live demo we use short terms + early full repayment so the whole lifecycle fits in minutes.

---

## 8. Data model (SQLite, off-chain state only)

- **borrowers**: id, name, kyc_status, credit_score, fiat_deposit_amount, fiat_locked, credit_limit, xrpl_address, credential_id
- **lenders**: id, xrpl_address, deposits[]
- **pools**: id, name, vault_id, share_mpt_id, loan_broker_id, cover_rate_min, target_apr, risk_tier
- **loans**: id, borrower_id, pool_id, principal, interest_rate, term_days, status, xrpl_loan_id, origination_tx, repayment_txs[]
- **fiat_ledger**: borrower_id, entry_type (deposit/lock/release/recover), amount, ts

Chain objects (vaults, loans, credentials) are the source of truth for on-chain state; the DB only holds what the chain can't/shouldn't (fiat, KYC, policy).

---

## 9. API surface (FastAPI)

```
POST /admin/bootstrap                  # run Devnet bootstrap
POST /admin/pools                      # create a pool (vault + broker + cover)
GET  /pools                            # list pools w/ TVL, APR, first-loss capital
POST /borrowers/onboard                # KYC + fiat deposit + issue credential
POST /borrowers/{id}/loans             # quote + originate (LoanSet)
POST /loans/{id}/repay                 # LoanPay (supports full early repayment)
POST /loans/{id}/default               # impair + default demo (LoanManage)
POST /lenders/{id}/deposit             # VaultDeposit
POST /lenders/{id}/withdraw            # VaultWithdraw
GET  /loans/{id}                       # status + tx hashes (explorer links)
```

---

## 10. Build plan / milestones

| # | Milestone | What "done" looks like |
|---|---|---|
| M0 | **Prune & scaffold** | Repo stripped to lending essentials; FastAPI + SQLite skeleton boots; Devnet client connects. |
| M1 | **Assets & identity** | RLUSD IOU issued on Devnet; permissioned domain + `CoinFish-Borrower` credential issue/accept working. |
| M2 | **Pools** | `VaultCreate` + `LoanBrokerSet` + `LoanBrokerCoverDeposit` → a live pool with first-loss capital; `vault_info` reads back. |
| M3 | **Lender flow** | `VaultDeposit`/`VaultWithdraw` end-to-end; shares + yield visible. |
| M4 | **Borrower flow** | Onboard → quote (risk engine) → `LoanSet` disburses in seconds → `LoanPay` full early repayment. |
| M5 | **Default flow** | `LoanManage` impair→default; first-loss capital draw demonstrated; lender protection shown. |
| M6 | **React dashboard** | Borrower / lender / admin views, live tx hashes + explorer links, latency callout. |
| M7 | **Demo polish** | One-command bootstrap + scripted happy-path + default-path; README + pitch. |
| S1 | *(Stretch)* **ZK solvency proof** | Vault proves "fiat collateral ≥ outstanding loans" to lenders without revealing borrower identities/amounts. See §12. |

Suggested order for a hackathon: M0→M2 first (gets *something* on-chain fast), then M4 (the headline), then M3/M5, then the React polish.

---

## 11. Risks & mitigations

- **Devnet instability / amendment churn** — Devnet resets and amendments move. Mitigation: pin to documented tx shapes, keep `bootstrap_devnet.py` idempotent and re-runnable, store seeds in `.env`.
- **`xrpl-py` lending models lagging rippled** — verified present in 5.0.0, but field-level mismatches possible. Mitigation: `xrpl_service` can fall back to submitting raw transaction JSON if a typed model is stale.
- **Fixed-term loans vs "instant settle" demo** — can't wait 30 days live. Mitigation: short terms + `tfLoanFullPayment` for repayment; `LoanManage` impair to force a fast default.
- **First-loss / fee math subtlety** — XLS-66 cover maths is specific. Mitigation: unit-test the rate/cover calculations against the worked example in the XRPL docs before wiring to chain.
- **Scope creep** — Mitigation: ZK is explicitly a stretch; one pool is enough to demo, multi-pool is a nice-to-have.

---

## 12. Stretch goal — ZK solvency proof

Goal: let CoinFish prove to lenders that **total off-chain fiat collateral ≥ total outstanding on-chain loans** (the platform is solvent) **without revealing** individual borrower identities, addresses, or amounts. Approach for a hackathon: a Groth16/PLONK circuit (e.g. `circom`/`snarkjs`, or a Python proving lib) over committed per-borrower balances, publishing a proof + Merkle root; verification result surfaced in the lender UI. Treated as fully optional and isolated so it can't jeopardise the core demo.

---

## 13. Explicitly out of scope for the MVP

Production custody/security, real fiat rails, real RLUSD, automated on-chain liquidation (XLS-66 itself omits this), mobile, multi-currency beyond the single RLUSD stand-in, and full regulatory tooling. Hackathon = the A→G Devnet path working for real, looking sharp.

---

## 14. Decisions locked (Jon)

1. **Term:** loans are a single fixed **30-day** term (max = 30), matching the protocol's fixed-term model. "Borrow indefinitely" = re-originate at maturity.
2. **Pools:** ship **3 pools** — Conservative (low risk, 20% first-loss buffer), Balanced (medium, 10%), High-Yield (high, 5%).
3. **Lenders:** **no KYC** for the MVP. Vaults are public on the deposit side; the permissioned domain + `CoinFish-Borrower` credential gate the **borrower** side only.
4. **Default + recovery:** **fully live** — on-chain default (`LoanManage` impair → default → first-loss capital draw) wired together with the off-chain fiat-recovery ledger entry, shown end to end.
