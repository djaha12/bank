# NEO BANK OS 2026

> A production-grade **virtual bank sandbox**. Full-stack neobank UX, a real
> double-entry ledger, KYC/AML/risk tooling, a backoffice, and an AI assistant
> layer — built to demonstrate how a modern banking platform is engineered.

---

## ⚠️ THIS IS A SANDBOX — NOT A REAL BANK

**NEO BANK OS 2026 is a prototype / educational project. It is NOT a regulated
financial institution and it does NOT move, hold, or transmit real money.**

- All balances are **play money** on an internal ledger. The only way money
  enters the system is a `DEMO_DEPOSIT` funded by a synthetic `SYSTEM/FUNDING`
  account (seed-only — it literally mints play money and is never exposed via
  the API).
- There are **no real PANs, no real IBANs, no card network, no settlement
  rails, no banking partner, and no real KYC/AML provider.**
- All "documents", "sanctions screening", "FX rates", and "OTP delivery" are
  **mocked**. The sanctions list is a hardcoded placeholder (`SANDBOX-DEMO-LIST`).
- **Do not deploy this as a financial service.** Operating a real bank or
  e-money business requires licensing, a banking/BaaS partner, audited PCI-DSS
  scope, real KYC/AML, and regulatory approval. See
  [`ROADMAP.md`](./ROADMAP.md) and [`COMPLIANCE.md`](./COMPLIANCE.md).
- This software **does not help anyone evade KYC, AML, sanctions, or any law.**
  Screening here is a non-functional placeholder by design.

---

## Features

| Domain | Capability | Notes |
| --- | --- | --- |
| **Identity** | Email/password + OTP (mock), DB-backed sessions, passkey-ready schema | `OTP_PROVIDER=mock` logs codes to console |
| **KYC** | Start → submit → admin review → account provisioning | Sandbox docs only; no real document storage |
| **Accounts** | Multi-currency (KGS / USD / EUR) checking accounts | Cached balance + holds projection over the ledger |
| **Ledger** | Append-only double-entry, per-currency balancing, system accounts | Truth lives in `LedgerEntry`; balances recomputable |
| **Transfers** | Own / P2P / Bank (sandbox) | Idempotent, rate-limited, risk-evaluated |
| **FX** | Cross-currency conversion via FX-position system accounts | Integer math, spread in basis points |
| **Cards** | Virtual debit issuance, freeze/unfreeze, limits, merchant controls | No real PAN — display `last4` + opaque token ref |
| **Card payments** | Simulated authorization (hold) or capture (settle) | Budget tracking + risk evaluation |
| **Analytics** | Spending-by-category, cashflow, budget progress | Deterministic computations over the ledger |
| **AI assistant** | Spending insight, fraud explanation, chat, compliance assist | Provider-pluggable; ships with a mock provider |
| **Risk / AML** | Rule-based engine, risk scores, AML alerts | Explainable, deterministic — not a real AML system |
| **Backoffice** | Customers, KYC review, AML, disputes, transactions, risk, audit | RBAC with fine-grained permissions |
| **Disputes** | Open → investigate → resolve, with optional refund (reversal) | Refund posts a compensating ledger transaction |
| **Audit** | Tamper-evident hash-chained audit log | `hash = sha256(prevHash + canonical(payload))` |
| **Security** | Zod validation, rate limiting, idempotency, secure headers | See [`SECURITY.md`](./SECURITY.md) |

---

## Tech stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript** (strict, with
  `noUncheckedIndexedAccess`).
- **Prisma 6** + **PostgreSQL 16**.
- **Tailwind CSS** + shadcn-style components + **Radix UI** + **framer-motion**
  + **recharts** + **lucide-react** + **sonner** (toasts).
- **jose** for admin JWT sessions; Node `crypto` (`scrypt`) for password
  hashing in the sandbox.
- **Zod** for input validation.
- **Vitest** (unit/integration) + **Playwright** (E2E).
- Money is always **BigInt minor units** in the domain; the REST API returns
  money as **strings** inside a `{ data }` envelope.

---

## Quickstart

### Prerequisites
- Node.js 22+
- Docker (for the local Postgres) **or** a local PostgreSQL 16 instance

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env if needed. Generate a real SESSION_SECRET for anything non-local:
#   openssl rand -hex 32
```
The example file contains **no real secrets** — only local placeholders.

### 3. Start the database
**Option A — Docker (recommended):**
```bash
docker compose up -d db        # local Postgres on :5432
```
**Option B — local Postgres:** create a database and point `DATABASE_URL` at it.
The default URL is:
```
postgresql://neobank:neobank@localhost:5432/neobank?schema=public
```

### 4. Run migrations
```bash
npx prisma migrate deploy      # apply committed migrations
# (during development you can use: npm run prisma:migrate)
```

### 5. Seed demo data
```bash
npm run db:seed                # seeds RBAC, system accounts, fees, FX, demo users
```

### 6. Run the app
```bash
npm run dev                    # http://localhost:3000
```

---

## Docker Compose

`docker-compose.yml` defines two services:

- **`db`** — Postgres 16 with a healthcheck and a named volume `neobank_pgdata`.
- **`app`** — the Next.js app (multi-stage `Dockerfile`). On first boot it runs
  `prisma migrate deploy`, seeds, then starts the standalone server.

```bash
# Just the database (then run the app locally with npm run dev):
docker compose up -d db

# The full stack (db + app) — app on http://localhost:3000:
docker compose up --build
```

> The compose file ships a placeholder `SESSION_SECRET` and `SEED_DEMO_DATA=true`
> for local demos. **Never** reuse these in a deployed environment.

---

## Migrations, seeding & tests

| Task | Command |
| --- | --- |
| Generate Prisma client | `npm run prisma:generate` |
| Create a dev migration | `npm run prisma:migrate` |
| Apply committed migrations | `npm run prisma:deploy` |
| Open Prisma Studio | `npm run prisma:studio` |
| Seed demo data | `npm run db:seed` |
| Reset DB (drop + migrate + seed) | `npm run db:reset` |
| Unit / integration tests | `npm run test` (Vitest) |
| Tests (watch) | `npm run test:watch` |
| E2E tests | `npm run test:e2e` (Playwright) |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Build | `npm run build` |

Vitest loads `.env` and runs test files **serially** (they share a DB).
Playwright assumes the app is running and the DB is seeded.

---

## Demo logins (LOCAL-ONLY)

Created by `npm run db:seed`. **These exist only in your local seeded database
and must never appear in a deployed environment.**

| Role | Email | Password |
| --- | --- | --- |
| Customer (KYC approved) | `demo@neobank.local` | `Password123!` |
| Admin (super admin) | `admin@neobank.local` | `Admin123!` |
| Compliance officer | `compliance@neobank.local` | `Admin123!` |
| Support agent | `support@neobank.local` | `Admin123!` |

Additional seeded customers (`nuray@`, `tilek@`, `pending@`, `rejected@`
`@neobank.local`) exercise different KYC/risk states. With `OTP_PROVIDER=mock`,
OTP codes are printed to the server console (and returned in dev responses as
`devCode`) so flows are testable.

---

## Architecture summary

```
Browser ──► Next.js App Router
              ├── Server Components (RSC)  ── read via Prisma (filtered by user)
              ├── Client Components        ── apiFetch() to Route Handlers
              └── Route Handlers (/api/*)  ── route() wrapper
                       │
                       ├── auth / session / RBAC guards
                       ├── Zod validation
                       ├── rate limit + idempotency (money ops)
                       ├── domain operations (transfers / fx / cards / reversal)
                       │        └── ledger.postTransaction()  (atomic, FOR UPDATE)
                       ├── risk engine + AML alerts
                       └── audit (hash-chain) + notifications
                                  │
                              PostgreSQL (Prisma)
```

- **Customer app** lives under `src/app/(app)/*` (server components guarded by
  `requirePageUser()`); **backoffice** under `src/app/admin/(panel)/*` (guarded
  by `requirePageAdmin()`).
- **Domain logic** lives in `src/lib/*` and `src/lib/operations/*`. Route
  handlers stay thin: validate, authorize, then delegate.
- See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the deep dive.

---

## Database schema overview

PostgreSQL via Prisma (`prisma/schema.prisma`). Money is `BigInt` minor units
everywhere. Key model groups:

- **Identity**: `User`, `CustomerProfile`, `WebAuthnCredential`, `OtpChallenge`.
- **KYC**: `KycApplication`, `KycDocument`, `SanctionsScreeningResult`.
- **Accounts & ledger**: `Account` (user + `SYSTEM` accounts), `LedgerEntry`
  (append-only), `Transaction`, `Transfer`, `Hold`.
- **Cards**: `Card`, `CardLimit`, `MerchantControl`.
- **Sessions & security**: `DeviceSession`, `LoginEvent`, `AuditLog`.
- **Money config**: `FeeRule`, `FxRate`, `IdempotencyKey`, `WebhookEvent`.
- **Risk/AML**: `RiskScore`, `AmlAlert`.
- **Money UX**: `SpendingCategory`, `Budget`, `SavingsGoal`.
- **AI**: `AiConversation`, `AiMessage`.
- **Admin/RBAC**: `AdminUser`, `Role`, `Permission`, `RolePermission`,
  `AdminUserRole`.
- **Disputes**: `Dispute`.

---

## Security model

- **Customer sessions** are DB-backed (`DeviceSession`): the raw token lives
  only in an `httpOnly` cookie; the DB stores its SHA-256 hash, enabling device
  listing, trust, and revocation.
- **Admin sessions** are short-lived signed JWTs (HS256 via `jose`); admin
  actions are additionally **audit-logged** at the handler level.
- **RBAC**: fine-grained permission keys (`PERMISSIONS`) bundled into roles
  (`super_admin`, `compliance_officer`, `support_agent`). Every admin route
  calls `requireAdmin(PERMISSIONS.X)`.
- **Customer isolation**: every query is filtered by `user.id`; money ops
  require `requireKycApprovedUser()`.
- **Input validation**: all bodies parsed with **Zod**; errors return `422`
  with field details and never leak stack traces.
- **Rate limiting**: per-bucket (`auth`, `otp`, `money`, `ai`) limits.
- **Idempotency**: money endpoints require an `Idempotency-Key` header and run
  under `withIdempotency`, guaranteeing no double-posting on retries.
- **Secure headers**: set globally in `next.config.mjs` (HSTS, X-Frame-Options
  DENY, nosniff, Referrer-Policy, Permissions-Policy).
- See [`SECURITY.md`](./SECURITY.md) for the full threat model & OWASP mapping.

---

## Ledger model

A real, testable **double-entry ledger** (`src/lib/ledger.ts`):

- **Append-only**: `LedgerEntry` rows are never updated or deleted. Corrections
  are made by posting **compensating** transactions (reversals/refunds).
- **Balanced per currency**: every posting has ≥ 2 legs and, for each currency,
  `sum(DEBIT) === sum(CREDIT)` (`assertBalancedPlan`). Leg amounts are positive;
  direction carries the sign.
- **System accounts** make the whole bank balance: `FUNDING`, `FEE_INCOME`,
  `FX_POSITION`, `SETTLEMENT`, `SUSPENSE`, `CARD_SCHEME` (one per currency).
- **Per-account cached balance** (`balanceCached`) is updated **atomically**
  inside the same DB transaction as the ledger append, with row locks
  (`SELECT … FOR UPDATE`) so concurrent postings serialize. It is provably
  reconcilable: `recomputeBalance()` re-derives it from the entries, and
  `/api/health` checks the whole ledger conserves value per currency.
- **Available balance** = `balanceCached - holdTotal` (card authorizations
  place holds before capture).
- **Idempotency** (`IdempotencyKey`) prevents duplicate postings on retry.
- **Audit hash-chain** (`AuditLog`): each row stores
  `hash = sha256(prevHash + canonical(payload))`; `verifyAuditChain()` detects
  any retro-edit.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full ledger + FX walkthrough.

---

## API overview

All responses use a `{ data }` envelope on success and
`{ error: { code, message, details } }` on failure. Money fields are strings.
Money-movement endpoints require an `Idempotency-Key` header.

| Method | Path | Auth | Idempotent |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | public | – |
| POST | `/api/auth/login` | public | – |
| POST | `/api/auth/logout` | session | – |
| GET | `/api/auth/me` | optional | – |
| POST | `/api/auth/otp/request` | public | – |
| POST | `/api/auth/otp/verify` | public | – |
| POST | `/api/kyc/start` | user | – |
| POST | `/api/kyc/submit` | user | – |
| GET | `/api/kyc/status` | user | – |
| GET | `/api/accounts` | user | – |
| GET | `/api/accounts/{id}` | user (owner) | – |
| GET | `/api/accounts/{id}/transactions` | user (owner) | – (`?format=csv` export) |
| POST | `/api/transfers/internal` | KYC-approved | ✅ |
| POST | `/api/transfers/p2p` | KYC-approved | ✅ |
| POST | `/api/transfers/bank` | KYC-approved | ✅ |
| POST | `/api/transfers/fx` | KYC-approved | ✅ |
| GET | `/api/transfers/{id}/receipt` | user (owner) | – |
| GET | `/api/cards` | user | – |
| POST | `/api/cards` | KYC-approved | – |
| POST | `/api/cards/{id}/freeze` | user (owner) | – |
| POST | `/api/cards/{id}/unfreeze` | user (owner) | – |
| PATCH | `/api/cards/{id}/limits` | user (owner) | – |
| POST | `/api/cards/{id}/simulate-purchase` | KYC-approved | ✅ |
| GET | `/api/analytics/spending` | user | – |
| GET | `/api/analytics/cashflow` | user | – |
| GET | `/api/analytics/budgets` | user | – |
| POST | `/api/ai/chat` | user | – |
| POST | `/api/ai/spending-insight` | user | – |
| POST | `/api/ai/risk-explanation` | user | – |
| GET | `/api/health` | public | – |
| POST | `/api/admin/login` | public | – |
| POST | `/api/admin/logout` | admin | – |
| GET | `/api/admin/customers` | `customers.read` | – |
| GET | `/api/admin/customers/{id}` | `customers.read` | – |
| PATCH | `/api/admin/customers/{id}` | `customers.write` | – |
| PATCH | `/api/admin/kyc/{id}/review` | `kyc.review` | – |
| GET | `/api/admin/aml-alerts` | `aml.read` | – |
| PATCH | `/api/admin/aml-alerts/{id}` | `aml.write` | – |
| GET | `/api/admin/disputes` | `disputes.read` | – |
| PATCH | `/api/admin/disputes/{id}` | `disputes.write` | – |
| GET | `/api/admin/transactions` | `transactions.read` | – |
| GET | `/api/admin/risk-scores` | `risk.read` | – |
| GET | `/api/admin/audit-logs` | `audit.read` | – |

Full request/response details: [`API.md`](./API.md) and [`openapi.yaml`](./openapi.yaml).

---

## Roadmap to production

This is a **sandbox**. To operate a real product you would need (non-exhaustive):

- [ ] **Legal & licensing** — banking/EMI license or a regulated banking-as-a-
      service partner; terms, privacy policy, complaints process.
- [ ] **Banking partner & rails** — real ledger of record, settlement, scheme
      membership (card network), payment rails (SEPA/SWIFT/local).
- [ ] **KYC/AML provider** — licensed identity verification, document checks,
      ongoing monitoring; real sanctions/PEP screening with maintained lists.
- [ ] **PCI-DSS** — if touching real PANs, tokenization via a PCI-compliant
      vault/processor and reduced PCI scope (or stay out of scope entirely).
- [ ] **Security** — independent penetration test, threat modeling, secrets in
      a KMS/HSM, argon2id + pepper or passkeys, Redis-backed rate limiting.
- [ ] **Compliance certifications** — SOC 2 Type II and/or ISO 27001, DPIA,
      GDPR/data-protection compliance, audit-log WORM storage.
- [ ] **Regulatory operations** — SAR/STR filing workflow, transaction
      monitoring tuning, sanctions list refresh, record retention.
- [ ] **Reliability** — read replicas, outbox pattern for events, backups/DR,
      observability (metrics/tracing/alerting), reconciliation jobs.

See [`ROADMAP.md`](./ROADMAP.md) for the phased plan and
[`COMPLIANCE.md`](./COMPLIANCE.md) for the compliance posture.

---

## License & disclaimer

Educational sandbox. Provided as-is, with no warranty. **Not financial advice,
not a financial product.** You are responsible for any deployment and for
complying with all applicable laws.
