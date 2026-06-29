# Compliance — NEO BANK OS 2026

> **This is a sandbox, not a regulated financial institution.** Everything in
> this document describes how compliance *concepts* are *modeled* for
> demonstration. None of it constitutes real KYC, AML, or sanctions screening,
> and none of it is a substitute for licensed compliance infrastructure or
> legal advice.

---

## 0. Explicit statement

**NEO BANK OS 2026 does NOT help anyone evade KYC, AML, sanctions, tax, or any
other legal obligation — and is not designed or permitted to.**

- The sanctions/PEP screening here is a **non-functional placeholder** that
  always returns `CLEAR` against a fake list (`SANDBOX-DEMO-LIST`). It cannot and
  must not be used to make real compliance decisions.
- The risk/AML engine is a deterministic teaching tool, not a real transaction-
  monitoring system.
- No feature is intended to anonymize illicit funds, bypass identity checks, or
  defeat screening. Misusing this code to do so is out of scope and prohibited.

---

## 1. KYC / onboarding (sandbox)

Modeled lifecycle (`KycApplication.status` → `User.kycStatus`):

```
NOT_STARTED ──/api/kyc/start──► PENDING
            ──/api/kyc/submit─► IN_REVIEW
   admin /api/admin/kyc/{id}/review ─► APPROVED | REJECTED | IN_REVIEW
```

- **Start** (`POST /api/kyc/start`): opens (or reuses) a `PENDING` application.
- **Submit** (`POST /api/kyc/submit`): captures profile data (name, DOB,
  nationality, residence, address, occupation, declared source of funds,
  `declaredPepStatus`, optional risk questionnaire) and **sandbox** document
  references. Moves to `IN_REVIEW` and runs a **placeholder** sanctions check.
- **Review** (`PATCH /api/admin/kyc/{id}/review`, requires `kyc.review`): a
  compliance officer approves/rejects. On first approval, the system provisions
  KGS/USD/EUR checking accounts.
- **Gating:** money movement and card issuance require `kycStatus === APPROVED`
  (`requireKycApprovedUser`). Unapproved users get `403 KYC_REQUIRED`.

**Documents:** `KycDocument` stores only a **mock** `storageRef`
(`sandbox://<TYPE>`) and optional filename — **no real document binaries or PII
images are ever stored.** Real document capture/verification requires a licensed
KYC provider with compliant storage, encryption, and retention.

---

## 2. Sanctions / PEP screening (placeholder)

- `SanctionsScreeningResult` records a `query`, an `outcome`
  (`CLEAR | POTENTIAL_MATCH | CONFIRMED_MATCH`), a `matchedList`, and a `score`.
- In the sandbox, KYC submission always writes a `CLEAR` result against
  `SANDBOX-DEMO-LIST` with score `0`. The risk engine has a
  `SANCTIONS_HIT` rule code and a placeholder high-risk country list
  (`["XA","XB","XC"]`) — **all fictional**.
- **No real sanctions lists are bundled or consulted.** Real screening
  (OFAC SDN, EU, UN, HMT, PEP databases, adverse media) requires a **licensed
  provider** with continuously maintained lists, fuzzy matching, and a
  documented match-disposition workflow. This must be added before any real use.

---

## 3. Risk engine rules (sandbox)

`src/lib/risk-engine.ts` — deterministic, **explainable** rules that produce
`RuleHit`s, which become `AmlAlert`s and update the customer's `RiskScore`
(0–100, `LOW | MEDIUM | HIGH | CRITICAL`). Rule codes (`AmlRuleCode`):

| Rule | Concept |
| --- | --- |
| `LARGE_TRANSACTION` | Single transfer over a per-currency threshold |
| `MANY_SMALL_TRANSFERS` | Structuring: many small transfers in 24h |
| `VELOCITY` | Too many transactions in 1h |
| `HIGH_RISK_COUNTRY` | Counterparty in a (fake) high-risk country |
| `UNUSUAL_MERCHANT` | Atypical merchant category |
| `NEW_DEVICE_LARGE_TRANSFER` | Large transfer from a new device |
| `FAILED_LOGINS` | Excess failed logins in 1h |
| `ABOVE_NORMAL_BEHAVIOR` | Amount far above the user's recent average |
| `SANCTIONS_HIT` | Placeholder sanctions match signal |

Thresholds are configurable constants (`RISK_THRESHOLDS`). Alerts are
**advisory** during a transfer (they record, they don't block in the sandbox);
real systems may hold/decline pending review. Each alert carries a human-readable
`reason` for auditability.

---

## 4. AML alert handling & escalation (conceptual)

- Alerts are surfaced in the backoffice and managed via
  `PATCH /api/admin/aml-alerts/{id}` (requires `aml.write`):
  `OPEN → REVIEWING → CLOSED`, with assignment-to-self and admin notes.
- An **AI compliance assistant** (`complianceAssist`) can summarize an alert and
  suggest next steps (review linked transaction, confirm KYC/risk tier, check
  for related accounts, document a decision, **escalate to SAR review if
  warranted**).
- **SAR/STR conceptual flow** (not implemented as a filing): in a real system a
  reviewed alert that meets reporting criteria would generate a **Suspicious
  Activity / Transaction Report** to the relevant Financial Intelligence Unit,
  with case management, the four-eyes principle, and strict confidentiality
  ("no tipping-off"). This sandbox models the **decision/escalation step** only;
  it does not file or transmit any report.

---

## 5. Data protection & consent

- **Data minimization:** only fields needed for the modeled flows are stored; no
  real document images, no PAN/CVV, no real account numbers/IBANs.
- **Sensitive values are hashed/redacted:** session tokens (`sha256`), OTP codes
  (HMAC pepper), passwords (`scrypt`). Cards expose only `last4` + opaque token.
- **Access control:** customers can only access their own data; admin access is
  permission-gated and **audited** (hash-chained `AuditLog`).
- **Soft delete:** `deletedAt` on users/accounts/cards supports retention and
  erasure modeling.
- **Consent/legal basis (gap):** a real deployment needs explicit consent
  capture, a privacy notice, a lawful basis per processing activity, DSAR/erasure
  handling, retention schedules, and (under GDPR) a **DPIA**. These are **not**
  implemented here.

---

## 6. Record keeping & auditability

- Every sensitive action writes a tamper-evident `AuditLog` entry
  (actor, action, entity, before/after, IP, user-agent), chained by hash.
- The double-entry ledger is append-only and reconstructable, supporting
  transaction record-keeping requirements **in concept**.
- **Gap:** regulated retention (often 5+ years), WORM storage, and immutable
  backups are not provided by the sandbox.

---

## 7. What is required to operate legally

You **cannot** run this as a real financial service as-is. At minimum you would
need:

1. **Authorization** — a banking/EMI/payments license, or operate under a
   licensed **banking-as-a-service / sponsor bank** partner, in each
   jurisdiction served.
2. **A licensed KYC/IDV provider** — real identity verification, document
   authentication, liveness, and ongoing re-verification.
3. **Real AML program** — risk-based KYC/CDD/EDD, a licensed transaction-
   monitoring system, sanctions/PEP screening with maintained lists, a named
   **MLRO/compliance officer**, SAR/STR filing, and staff training.
4. **Card/payment compliance** — scheme membership and **PCI-DSS** scope
   management if touching card data; payment-rail agreements (SEPA/SWIFT/local).
5. **Data protection** — GDPR/local privacy compliance, DPIA, DPO where
   required, consent and retention controls.
6. **Security assurance** — penetration testing, SOC 2 / ISO 27001, secure SDLC.
7. **Consumer protection** — clear T&Cs, disclosures, complaints handling,
   dispute/chargeback rights, and safeguarding of customer funds.
8. **Ongoing supervision** — regulatory reporting, audits, and list/rule
   maintenance.

See [`ROADMAP.md`](./ROADMAP.md) for how these map to delivery phases, and
[`SECURITY.md`](./SECURITY.md) for the security posture and gaps.
