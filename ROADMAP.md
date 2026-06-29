# Roadmap — NEO BANK OS 2026

> From **sandbox prototype** to a **licensed, production financial product**.
> This is a planning document. **Today the project is a sandbox and must not be
> operated as a real bank.** See [`COMPLIANCE.md`](./COMPLIANCE.md) and
> [`SECURITY.md`](./SECURITY.md).

---

## Where we are today (Phase 0 — Sandbox, shipped)

- ✅ Real, testable **double-entry ledger** (append-only, per-currency balanced,
  system accounts, atomic cached balances with row locks).
- ✅ Multi-currency accounts (KGS/USD/EUR), transfers (own/p2p/bank), FX, virtual
  cards (issue/freeze/limits/merchant controls), simulated card purchases.
- ✅ **Idempotency** + **rate limiting** + **Zod validation** on money flows.
- ✅ KYC lifecycle, rule-based **risk/AML** engine, AML alerts, disputes with
  refunds (reversals).
- ✅ **RBAC** backoffice; tamper-evident **audit hash-chain**.
- ✅ Analytics, AI assistant (mock provider), notifications.
- ✅ Secure headers, DB-backed customer sessions, admin JWT, scrypt/OTP (mock).
- ✅ Docker compose, migrations, seed, unit/integration/E2E test harnesses.

All external dependencies (OTP, AI, sanctions screening, document storage, card
network, settlement) are **mocked**.

---

## Phase 1 — Production engineering hardening

Make the platform operationally sound (still pre-launch, no real money).

- [ ] **Auth:** argon2id (or passkeys) + KMS-held pepper; enforce email
      verification; real OTP delivery (email/SMS provider); separate signing keys.
- [ ] **Rate limiting → Redis** (or equivalent) behind the existing interface.
- [ ] **Audit:** monotonic sequence + WORM/append-only storage; remove chain
      fork risk; signed batches.
- [ ] **CSP:** add a strict Content-Security-Policy; review all security headers
      per environment.
- [ ] **Reliability:** read replicas, **outbox** for events/notifications/webhooks,
      connection pooling, backups + DR, reconciliation jobs (`balanceCached`
      vs `recomputeBalance`).
- [ ] **Observability:** metrics, tracing, alerting (ledger integrity, declines,
      idempotency/rate-limit conflicts).
- [ ] **Secure SDLC:** SAST/DAST/dependency scanning in CI; threat-model reviews.

---

## Phase 2 — Compliance & legal foundation

Stand up the program required to handle real customers and money.

- [ ] **Licensing / partner:** obtain a banking/EMI/payments license **or**
      contract a licensed **banking-as-a-service / sponsor bank** per market.
- [ ] **KYC/IDV provider:** integrate licensed identity verification, document
      authentication, liveness; compliant PII storage, encryption, retention.
- [ ] **Real AML program:** risk-based CDD/EDD, licensed transaction monitoring,
      **real sanctions/PEP screening** with maintained lists (replace
      `SANDBOX-DEMO-LIST`), named MLRO, **SAR/STR filing** workflow + case
      management (four-eyes, no tipping-off), staff training.
- [ ] **Data protection:** GDPR/local compliance, DPIA, DPO where required,
      consent capture, DSAR/erasure, retention schedules.
- [ ] **Consumer protection:** T&Cs, disclosures, complaints handling,
      dispute/chargeback rights, **safeguarding of customer funds**.

---

## Phase 3 — Real rails & payments

Replace simulations with real money movement.

- [ ] **Ledger of record alignment:** reconcile the internal ledger against the
      partner/core banking system; define source of truth and break-handling.
- [ ] **Payment rails:** SEPA/SWIFT/local schemes; account/IBAN issuance via the
      partner; real settlement and clearing (replace `SETTLEMENT` sandbox).
- [ ] **Cards:** card-scheme membership or a card-issuing partner; **PCI-DSS**
      scope management — tokenize via a PCI-compliant vault/processor; real
      authorization/clearing/settlement and disputes/chargebacks.
- [ ] **FX:** real-time rate feeds, hedging/treasury for the FX position,
      regulatory FX handling.
- [ ] **Webhooks:** real inbound scheme/partner events with idempotent,
      signature-verified processing (`WebhookEvent` is scaffolded).

---

## Phase 4 — Certification & launch

- [ ] **Independent penetration test** + remediation.
- [ ] **SOC 2 Type II** and/or **ISO 27001** certification.
- [ ] **Regulatory approval / go-live sign-off** with the relevant authority/partner.
- [ ] **Operational readiness:** on-call, incident response, business continuity,
      regulatory reporting cadence, list/rule maintenance.
- [ ] **Phased rollout:** closed beta → limited launch → general availability,
      with monitoring and kill-switches.

---

## Production gaps checklist (single view)

| Area | Sandbox today | Required for production |
| --- | --- | --- |
| Licensing | none | Bank/EMI license or sponsor-bank partner |
| KYC/IDV | mock docs, no verification | Licensed IDV + document/liveness checks |
| Sanctions/PEP | placeholder, always CLEAR | Licensed screening + maintained lists |
| AML monitoring | rule-based demo | Licensed monitoring, MLRO, SAR/STR filing |
| Money rails | internal ledger only | Real settlement, IBANs, SEPA/SWIFT/local |
| Cards | virtual, no PAN, simulated | Issuer/scheme partner, PCI-DSS, real auth |
| Auth | scrypt + mock OTP | argon2id/passkeys, KMS, real OTP delivery |
| Rate limiting | in-memory | Distributed (Redis) |
| Audit | hash-chain (fork risk) | Monotonic + WORM, signed |
| Secrets | env + SESSION_SECRET | KMS/HSM, rotation, separation |
| Data protection | minimal modeling | GDPR/DPIA/consent/retention/DSAR |
| Security assurance | self-review | Pentest, SOC 2 / ISO 27001, secure SDLC |
| Reliability | single instance | Replicas, outbox, backups/DR, monitoring |
| Funds | play money (mint via FUNDING) | Real safeguarding; remove demo mint path |
