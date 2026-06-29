# Architecture — NEO BANK OS 2026

> Sandbox prototype. A real, testable double-entry ledger and a layered Next.js
> app. Money is **BigInt minor units** in the domain; the REST API returns money
> as **strings** inside a `{ data }` envelope.

---

## 1. System overview

```
                          ┌──────────────────────────────────────────────┐
                          │                   Browser                     │
                          │   Customer app  /  Admin backoffice (SPA-ish) │
                          └───────────────┬───────────────┬──────────────┘
                                          │ RSC payloads  │ fetch (apiFetch)
                                          ▼               ▼
              ┌──────────────────────────────────────────────────────────┐
              │                Next.js 15 (App Router, Node)              │
              │                                                          │
              │  Server Components            Route Handlers (/api/*)    │
              │  ───────────────             ───────────────────────    │
              │  requirePageUser()           route() wrapper            │
              │  requirePageAdmin()            ├─ auth / RBAC guards     │
              │  prisma read (by user.id)      ├─ Zod validation         │
              │                                ├─ rate limit             │
              │                                ├─ idempotency (money)    │
              │                                ├─ domain operations ─────┼──► src/lib/operations/*
              │                                │     └─ ledger.postTransaction()
              │                                ├─ risk engine / AML      │
              │                                └─ audit (hash-chain) +   │
              │                                   notifications          │
              └───────────────────────────────┬──────────────────────────┘
                                               │ Prisma
                                               ▼
                                    ┌────────────────────┐
                                    │   PostgreSQL 16    │
                                    │  (ledger of truth) │
                                    └────────────────────┘

External adapters (mock-only today): OTP provider, AI provider.
```

Key principles:
- **Thin handlers, fat domain.** Route handlers validate + authorize, then
  delegate to `src/lib/operations/*`, which call the ledger.
- **The ledger is the source of truth.** Cached balances are projections kept in
  lockstep with append-only entries inside the same DB transaction.
- **One uniform wrapper** (`route()`) gives every endpoint consistent error
  handling and the `{ data }` / `{ error }` envelope.

---

## 2. Modules

| Layer | Files | Responsibility |
| --- | --- | --- |
| API plumbing | `src/lib/api.ts` | `route`, `ok`, `fail`, `parseBody`, `getClientContext`, `getIdempotencyKey`, `enforceRateLimit` |
| Errors | `src/lib/errors.ts` | `AppError` + `Errors.*` factory (stable codes + HTTP status) |
| Validation | `src/lib/validation.ts` | Zod schemas for every request body |
| Money | `src/lib/money.ts` | `Money`, `toMinorUnits`, `fromMinorUnits`, `formatMoney`, `serializeBigInt` |
| Ledger | `src/lib/ledger.ts` | `assertBalancedPlan`, `postTransaction`, `recomputeBalance` |
| System accounts | `src/lib/system-accounts.ts` | `getSystemAccount`, `SYSTEM_ACCOUNT_MATRIX` |
| Fees | `src/lib/fees.ts` | `computeFee` (flat + bps), `feeKeyFor` |
| FX | `src/lib/fx.ts` | `quoteFx` (integer rate math + spread) |
| Limits | `src/lib/limits.ts` | transfer/card limit checks, `cardSpend` |
| Operations | `src/lib/operations/{transfers,fx,cards,reversal,deposit}.ts` | Orchestrate checks + posting in a serializable tx |
| Risk/AML | `src/lib/risk-engine.ts` | rule functions + `evaluateTransactionRisk` + `applyRiskOutcome` |
| Idempotency | `src/lib/idempotency.ts` | `withIdempotency`, `hashRequest`, `canonicalJson` |
| Rate limit | `src/lib/ratelimit.ts` | in-memory fixed-window limiter |
| Auth | `src/lib/auth.ts` | `requireUser`, `requireKycApprovedUser`, OTP, registration |
| Session | `src/lib/session.ts` | customer (DB-backed) + admin (JWT) sessions |
| RBAC | `src/lib/rbac.ts` | `PERMISSIONS`, `ROLE_DEFINITIONS`, `requireAdmin` |
| Page guards | `src/lib/page-auth.ts` | `requirePageUser`, `requirePageAdmin` |
| Audit | `src/lib/audit.ts` | `writeAudit` (hash-chain), `verifyAuditChain` |
| Notifications | `src/lib/notifications.ts` | `notify` |
| Analytics | `src/lib/analytics.ts` | spending-by-category, cashflow, budgets, subscriptions |
| AI | `src/lib/ai/*` | provider factory + mock provider + `chat`/insight/compliance |
| Crypto | `src/lib/crypto.ts` | scrypt password, peppered OTP, tokens, sha256 |
| Client | `src/lib/client.ts` | `apiFetch`, `newIdempotencyKey` (client components) |

---

## 3. Data flow: a transfer (sequence)

`POST /api/transfers/internal` (mirrors p2p/bank):

```
Client
  │  POST /api/transfers/internal
  │  headers: Idempotency-Key: <uuid>
  │  body: { fromAccountId, toAccountId, amount:"100.00", note? }
  ▼
route() wrapper
  ├─ requireKycApprovedUser()            → 401/403 if not authed/KYC
  ├─ enforceRateLimit(req,"money",…,uid) → 429 if over 30/min
  ├─ getIdempotencyKey(req)              → 422 if header missing/short
  ├─ parseBody(req, transferInternalSchema) (Zod) → 422 on invalid
  ├─ load `from` account; assert from.userId === user.id → 403
  ├─ amount = toMinorUnits("100.00", from.currency)  // BigInt
  └─ withIdempotency({key, userId, endpoint, body}, handler)
        │  (creates IdempotencyKey row IN_PROGRESS; replays/conflicts on retry)
        ▼
     executeTransfer(...)  // prisma.$transaction, Serializable
        ├─ re-validate user/account status, ownership, currency match
        ├─ computeFee(...)              // flat + bps from FeeRule
        ├─ available = balanceCached - holdTotal; assert >= amount+fee → 402
        ├─ checkTransferLimits(...)     → 422 LIMIT_EXCEEDED
        ├─ build legs: DEBIT from, CREDIT to (+ fee legs to FEE_INCOME)
        ├─ postTransaction(tx, plan):
        │     ├─ assertBalancedPlan(plan)            // per-currency D==C
        │     ├─ create Transaction (+ postedAt)
        │     ├─ SELECT … FOR UPDATE on involved accounts (row locks)
        │     ├─ append LedgerEntry rows (with balanceAfter)
        │     └─ update each account.balanceCached
        ├─ create Transfer row
        ├─ evaluateTransactionRisk(...) + applyRiskOutcome(...)  // AML alerts
        ├─ writeAudit("transfer.create", …)          // hash-chained
        └─ notify(user, "Transfer sent")
        ▼  returns { transferId, transactionId, status, balances, fee, alerts }
   handler wraps result with serializeBigInt → { status:201, body }
   IdempotencyKey row marked COMPLETED (stores body + transactionId)
  ▼
ok(body, 201) → { data: { ...strings... } }
```

**Declines** (`INSUFFICIENT_FUNDS` / `LIMIT_EXCEEDED`) roll back the main tx, and
a separate committed transaction records a `FAILED` `Transaction` (no ledger
entries) plus a "declined" notification — so the user sees the attempt without
any value moving.

---

## 4. Ledger model (in depth)

`src/lib/ledger.ts`. Invariants (validated by `assertBalancedPlan`, unit-tested
without a DB):

1. **Append-only.** `LedgerEntry` rows are never updated/deleted. Corrections
   are **compensating** postings (`reverseTransaction` swaps each leg's
   direction; original txn → `REVERSED`).
2. **≥ 2 legs, balanced per currency.** For each currency in a posting,
   `Σ DEBIT == Σ CREDIT`. Leg amounts are **positive minor units**; the
   `direction` carries the sign (`legDelta`: CREDIT = +amount, DEBIT = −amount).
3. **Customer bank-statement convention.** A USER account balance **increases on
   CREDIT** (money in) and **decreases on DEBIT** (money out).
4. **System accounts close the books.** Every external/fee/FX/card movement
   routes through a `SYSTEM` account so the *whole bank* nets to zero per
   currency:
   - `FUNDING` — source of demo money (seed-only mint).
   - `FEE_INCOME` — collected fees.
   - `FX_POSITION` — per-currency FX inventory.
   - `SETTLEMENT` — external/bank-sandbox clearing.
   - `SUSPENSE` — holds/unresolved clearing.
   - `CARD_SCHEME` — card-network settlement.
   One per currency (`SYSTEM_ACCOUNT_MATRIX`), seeded once.
5. **Atomic projection.** `postTransaction` runs inside the caller's
   `prisma.$transaction`, locks involved accounts with `SELECT … FOR UPDATE`
   (raw SQL, UUIDs via `Prisma.join`), appends entries with `balanceAfter`, and
   updates `balanceCached` — all atomically. Concurrent postings serialize on
   the locked rows.
6. **Available balance.** `available = balanceCached - holdTotal`. Card
   authorizations place a `Hold` (increasing `holdTotal`) before capture.
7. **Provable correctness.** `recomputeBalance()` re-derives a balance from
   entries; `/api/health` checks `Σ credits == Σ debits` per currency across the
   whole ledger; tests assert no drift.

---

## 5. FX model

`src/lib/fx.ts` + `src/lib/operations/fx.ts`:

- `FxRate` stores a **mid-market rate scaled by `scale` (default 1e8)** as a
  BigInt, plus a `spreadBps`. No floats on the wire.
- `quoteFx(base, quote, inputAmount)`:
  - `effectiveRateScaled = rateScaled * (10000 - spreadBps) / 10000` (spread
    applied **against** the customer),
  - `outputAmount = inputAmount * effectiveRateScaled / scale` (floor).
- A conversion posts a **balanced, per-currency** 4-leg transaction:
  - base side: `DEBIT customer(base)` / `CREDIT FX_POSITION(base)`,
  - quote side: `DEBIT FX_POSITION(quote)` / `CREDIT customer(quote)`,
  - plus optional fee legs in the base currency.
  Each currency balances independently; the FX position absorbs the spread/risk.
- Assumes equal minor-unit scale across KGS/USD/EUR (all 2 decimals); adding a
  0-/3-decimal currency requires a decimal-delta adjustment (noted in code).

---

## 6. Request lifecycle

1. **`route(handler)`** wraps every handler in try/catch → `fail()` maps
   `AppError`/`ZodError`/unknown to safe JSON (no stack traces leak).
2. **Auth/guard** — `requireUser` / `requireKycApprovedUser` / `requireAdmin(perm)`.
3. **Rate limit** — `enforceRateLimit(req, bucket, cfg, id)` (money/ai keyed by
   user id).
4. **Idempotency (money)** — `getIdempotencyKey` + `withIdempotency`.
5. **Validation** — `parseBody(req, schema)`.
6. **Ownership** — re-check `userId` on every resource.
7. **Domain op** — serializable `prisma.$transaction`.
8. **Side effects** — risk eval, audit, notifications.
9. **Serialize** — `serializeBigInt` then `ok(data, status)` → `{ data }` (money
   as strings).

Errors carry stable machine codes: `UNAUTHORIZED (401)`, `FORBIDDEN (403)`,
`KYC_REQUIRED (403)`, `BLOCKED (403)`, `NOT_FOUND (404)`,
`INSUFFICIENT_FUNDS (402)`, `CONFLICT (409)`,
`VALIDATION_ERROR / LIMIT_EXCEEDED (422)`, `RATE_LIMITED (429)`,
`INTERNAL (500)`.

---

## 7. Folder structure

```
prisma/
  schema.prisma            # models, enums, indexes
  migrations/              # committed SQL migrations
  seed.ts / seed.main.ts   # RBAC, system accounts, fees, FX, demo data
src/
  app/
    (app)/<page>/page.tsx        # customer pages (server) — requirePageUser()
    admin/(panel)/<page>/...     # backoffice pages (server) — requirePageAdmin()
    api/<domain>/.../route.ts    # route handlers (export const GET/POST/PATCH)
    layout.tsx, globals.css      # shared shell + styles
  lib/
    api.ts errors.ts validation.ts money.ts idempotency.ts ratelimit.ts
    auth.ts session.ts rbac.ts page-auth.ts crypto.ts db.ts
    ledger.ts fees.ts fx.ts limits.ts system-accounts.ts audit.ts
    notifications.ts analytics.ts risk-engine.ts client.ts
    operations/{transfers,fx,cards,reversal,deposit}.ts
    ai/{service,provider,mock-provider,types}.ts
  components/
    ui/*        # shadcn-style primitives
    brand/*     # MoneyText, VirtualCard, StatCard, charts, PageHeader, …
    app/*       # app-shell, nav-config
tests/          # vitest unit/integration + e2e (Playwright)
next.config.mjs docker-compose.yml Dockerfile .env.example
```

---

## 8. Scaling notes (sandbox → production)

The sandbox is intentionally single-instance. To scale:

- **Rate limiting → Redis.** The in-memory limiter is per-process. Swap the
  `RateLimiter` implementation for a Redis (or token-bucket) backend behind the
  same interface so limits hold across instances.
- **Read replicas.** Route read-only queries (analytics, admin lists, account
  history) to replicas; keep ledger writes on the primary. Mind replica lag for
  read-after-write on balances.
- **Outbox pattern for events.** Notifications, webhooks, and downstream events
  should be written to an outbox table in the same DB transaction as the ledger
  write, then published asynchronously — guaranteeing exactly-once side effects.
- **Audit at scale.** Replace the hash-chain-with-possible-fork with a monotonic
  sequence + WORM/append-only store; sign batches.
- **DB hardening.** Connection pooling (PgBouncer), partitioning of
  `LedgerEntry`/`Transaction` by time, careful index review, and periodic
  reconciliation jobs comparing `balanceCached` to `recomputeBalance`.
- **Idempotency/locking.** Current row-locking + serializable txns are correct
  but contend under load; consider per-account sharding/queues for hot accounts.
- **Sessions/secrets.** Move signing/pepper to a KMS; consider stateless +
  revocation lists for horizontal scale.
- **Observability.** Add metrics, distributed tracing, and alerting around
  ledger integrity, declines, and rate-limit/idempotency conflicts.
