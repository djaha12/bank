# NEO BANK OS 2026 — CTO Self-Audit

> **Status:** Sandbox prototype. This audit was performed as if by the CTO of a
> pre-licence fintech, to harden the codebase and produce an honest list of what
> must be done before this could ever touch real money.

## Methodology

A multi-agent adversarial review was run across six dimensions — **ledger /
financial correctness, security & authz (OWASP API Top 10), KYC/AML/compliance,
API correctness, frontend/UX, and architecture/scaling**. Every "bug" finding
was then re-checked by an independent verifier instructed to *refute* it by
reading the actual code, so only confirmed defects were actioned.

- **24 findings** surfaced (14 candidate bugs, 10 production gaps).
- **4 bugs confirmed** by verification → **all 4 fixed** (plus several cheap
  hardening fixes).
- Remaining items are tracked below as **production gaps**.

Verification gates run after the fixes: `tsc --noEmit` clean, **36/36 tests
pass** (incl. new risk-ordering regressions), `next build` succeeds and emits
the standalone server, and a live runtime smoke test (login → transfer →
idempotent replay → admin RBAC) passes with exact ledger math.

---

## Confirmed bugs found and FIXED

| # | Severity | Area | Issue | Fix |
|---|----------|------|-------|-----|
| 1 | **Critical** | Docker/Deploy | `Dockerfile` + compose `app` expected Next.js standalone output, but `next.config.mjs` never set `output: "standalone"` → image build/run fails. | Added `output: "standalone"`. Verified `.next/standalone/server.js` is emitted. |
| 2 | **High** | Idempotency | On a post-commit bookkeeping failure, the idempotency key was **deleted** even though the money had already moved → a retry could **double-post**. | Split handler execution from bookkeeping: delete the key only when the handler *threw* (rolled back); on a post-commit update failure the key is left `IN_PROGRESS` so a retry is safely rejected (409). |
| 3 | **High** | Risk/AML | `ABOVE_NORMAL_BEHAVIOR` baseline was polluted by the *current* transfer (the `Transfer` row was created before risk eval), suppressing the rule. | Risk is now evaluated on **pre-transaction state** (before the `Transfer`/ledger rows exist). Regression test added. |
| 4 | **Medium** | Risk/AML | `UNUSUAL_MERCHANT` could never fire — the current purchase's `Hold` (carrying its MCC) was written before risk eval, so the MCC was always "known". | Risk is now evaluated **before** the hold is created. Regression test added (fires on first-time MCC). |

### Additional hardening applied during the audit
- **Idempotency cross-user isolation** — replay now rejects if the stored key
  belongs to a different principal (no cross-customer response replay).
- **CSRF defense-in-depth** — the shared `route()` wrapper rejects cross-origin
  state-changing browser requests (Origin≠Host), on top of `SameSite=lax`.
- **Secret fail-fast** — `SESSION_SECRET` (session JWT + OTP pepper) now throws
  at request time in production if missing/`<32` chars instead of silently
  using a dev literal.
- **Card state machine** — `unfreeze` now requires the card to actually be
  `FROZEN` (no `ACTIVE→ACTIVE` no-ops).
- **Dispute refunds** are already double-spend-safe: `reverseTransaction`
  refuses to reverse an already-`REVERSED` transaction.

---

## Production gaps (must be resolved before a real launch)

These are **intentional sandbox simplifications or known limitations** — not
bugs in the current prototype, but blockers for a licensed product.

### Compliance & financial (highest priority)
- **Real KYC/AML/sanctions provider.** Screening is a sandbox stub
  (`SanctionsScreeningResult` is written but not yet consulted in the money path).
  Wire a licensed provider and **block/escalate on POTENTIAL/CONFIRMED matches**;
  implement the `SANCTIONS_HIT` critical rule end-to-end.
- **Authorization hold lifecycle.** ✅ RESOLVED — `captureHold` / `releaseHold`
  (ledger move + `holdTotal` decrement + status) and an `expireHolds` sweeper are
  implemented (`src/lib/operations/holds.ts`), exposed via `POST /api/holds/[id]/capture`
  (idempotent) and `/release`, surfaced as "Pending authorizations" on the cards page,
  and covered by integration tests. Production still needs the sweeper on a real
  scheduler/cron.
- **Transaction monitoring at scale.** The rule engine is synchronous and
  in-request; production needs an async monitoring pipeline, case management,
  SAR workflow, and tunable thresholds per risk tier.
- **Audit log integrity.** The hash-chain is best-effort and can fork under
  concurrency. Use a monotonic sequence + WORM/append-only storage and periodic
  external anchoring.

### Security
- **Secrets management** — move signing keys/peppers to a KMS/HSM; separate the
  admin-JWT key from the session/OTP secret; rotate.
- **Rate limiting is in-memory (single instance).** Move to Redis behind the
  existing `RateLimiter` interface for multi-instance correctness.
- **OTP brute-force** — add a per-email/(email,purpose) lockout in addition to
  the per-challenge attempt cap and the per-IP limiter.
- **Passwords → passkeys.** scrypt is a sandbox mock; prefer WebAuthn passkeys
  (schema is ready) and argon2id for any password fallback.
- **Idempotency key identity** — consider promoting per-user scoping into the DB
  unique constraint `(userId, key, endpoint)` (currently enforced in code).
- **Full FAPI-grade auth** — DPoP/mTLS, token binding, step-up for high-risk ops.

### Money movement
- **Dispute refund idempotency** — require an `Idempotency-Key` on the dispute
  refund PATCH (today it is protected only by the reverse-once guard).
- **Real rails** — internal-only sandbox ledger today; integrate a banking
  partner / card processor / FX liquidity provider (behind adapters already
  hinted at in the architecture).

### Platform & scaling
- **Postgres** — connection pooling (PgBouncer), read replicas for reporting,
  partitioning `LedgerEntry`/`Transaction`, and an outbox for events/webhooks.
- **Observability** — structured logging, metrics, tracing, alerting; a ledger
  integrity job (the `/api/health` probe is a first step).
- **CI/CD** — automated migrations, blue/green deploys, secrets injection;
  Prisma engine provisioning in the Docker build (the local build fetches the
  engine out-of-band).

### Product / UX
- **Accessibility & i18n** pass (KGS-first, RU/EN), full keyboard/ARIA coverage.
- **Notifications/webhooks** delivery (email/push) beyond in-app records.

---

## What is genuinely solid today
- **Double-entry ledger**: append-only, balances per currency, system accounts,
  cached balance projection proven equal to the recomputed ledger by tests.
- **Idempotent money movement** with per-user isolation and double-post safety.
- **RBAC** backoffice with audited admin actions and a tamper-evident audit log.
- **Deterministic, explainable risk/AML rules** with verified firing behaviour.
- **Clean AI service boundary** (mock → real LLM via one adapter).
- **Strict TypeScript**, validated inputs (Zod), safe error handling, secure
  headers, premium responsive UI with dark/light and full UI states.
