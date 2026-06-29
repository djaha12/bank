# API Reference — NEO BANK OS 2026

> Sandbox REST API exposed by Next.js route handlers under `/api/*`.

## Conventions

- **Success envelope:** `{ "data": <payload> }` with an appropriate HTTP status
  (200/201). Produced by `ok()`.
- **Error envelope:** `{ "error": { "code": string, "message": string,
  "details": any | null } }`. Produced by `fail()`.
  - Common codes: `UNAUTHORIZED (401)`, `FORBIDDEN (403)`, `KYC_REQUIRED (403)`,
    `BLOCKED (403)`, `NOT_FOUND (404)`, `INSUFFICIENT_FUNDS (402)`,
    `CONFLICT (409)`, `VALIDATION_ERROR (422)`, `LIMIT_EXCEEDED (422)`,
    `RATE_LIMITED (429)`, `INTERNAL (500)`. Zod failures →
    `VALIDATION_ERROR (422)` with `details` = flattened field errors.
- **Money:** sent **in** as decimal strings (e.g. `"100.00"`, `>0`, ≤2 decimals);
  returned **out** as strings (BigInt minor units serialized via
  `serializeBigInt`).
- **Auth:**
  - Customer endpoints use the `nb_session` cookie (set on login/OTP verify).
  - Admin endpoints use the `nb_admin` cookie (set on admin login).
  - "KYC-approved" means `requireKycApprovedUser()` (`kycStatus === APPROVED`).
- **Idempotency:** money-movement endpoints **require** an `Idempotency-Key`
  request header (8–200 chars). Same key + same body replays the stored response;
  same key + different body → `422`; in-flight retry → `409`.
- **Rate limits:** `auth` 10/min, `otp` 5–10/min, `money` 30/min (per user),
  `ai` 20/min (per user).

---

## Auth

### POST `/api/auth/register`
Public. Rate-limited (`auth`). Creates a user + profile and issues a `SIGNUP`
OTP.
- Body: `{ email, password(8–128), firstName, lastName }`
- 201 → `{ data: { userId, devCode? } }` (`devCode` present only when
  `NODE_ENV !== "production"`).

### POST `/api/auth/login`
Public. Rate-limited (`auth`). Verifies credentials, creates a DB-backed session
cookie, logs a `LoginEvent` + audit.
- Body: `{ email, password }`
- 200 → `{ data: { user: { id, email, kycStatus } } }`
- 401 `UNAUTHORIZED` on bad credentials.

### POST `/api/auth/logout`
Revokes the current session and clears the cookie.
- 200 → `{ data: { ok: true } }`

### GET `/api/auth/me`
Returns the current user + profile, or `null` if unauthenticated.
- 200 → `{ data: { user: { id, email, status, kycStatus }, profile } }` or
  `{ data: null }`.

### POST `/api/auth/otp/request`
Public. Rate-limited (`otp`). Issues an OTP (mock provider logs it).
- Body: `{ email, purpose?: "LOGIN"|"SIGNUP"|"STEP_UP" = "LOGIN" }`
- 200 → `{ data: { delivered: true, devCode? } }`

### POST `/api/auth/otp/verify`
Public. Rate-limited (`otp`). Verifies an OTP and, on success, creates a session.
- Body: `{ email, code(6 digits), purpose? }`
- 200 → `{ data: { ok: true } }`
- 401 on invalid/expired code; 404 if no account for the email.

---

## KYC

### POST `/api/kyc/start`
Requires user. Opens (or reuses) a `PENDING` application; sets `kycStatus=PENDING`.
- 200 → `{ data: { application: { id, status, createdAt }, kycStatus } }`

### POST `/api/kyc/submit`
Requires user. Upserts profile, captures application data + **sandbox** document
references, runs the placeholder sanctions check, sets `kycStatus=IN_REVIEW`.
- Body: `{ firstName, lastName, dateOfBirth, nationality(2), country(2),
  addressLine1, addressLine2?, city, postalCode, occupation,
  sourceOfFunds: "SALARY"|"BUSINESS"|"INVESTMENTS"|"SAVINGS"|"OTHER",
  declaredPepStatus=false, riskQuestionnaire?,
  documents?: [{ type: "PASSPORT"|"ID_CARD"|"DRIVERS_LICENSE"|"PROOF_OF_ADDRESS"|"SELFIE", fileName? }] (≤10) }`
- 201 → `{ data: { application: { id, status, submittedAt }, kycStatus } }`

### GET `/api/kyc/status`
Requires user. Latest application + documents.
- 200 → `{ data: { kycStatus, application | null, documents[] } }`

---

## Accounts

### GET `/api/accounts`
Requires user. The caller's non-deleted USER accounts, oldest-first.
- 200 → `{ data: Account[] }` (money fields as strings).

### GET `/api/accounts/{id}`
Requires user + ownership. Account with up to 20 active `HELD` holds.
- 200 → `{ data: Account & { holds: Hold[] } }`; 404 if not owned/found.

### GET `/api/accounts/{id}/transactions`
Requires user + ownership. Ledger entries joined to their transaction.
- Query: `take` (≤100, default 25), `cursor` (entry id), `format=csv`.
- JSON 200 → `{ data: { entries[], nextCursor, hasMore } }` (newest-first).
- `format=csv` → `text/csv` attachment (`date,type,direction,amount,balanceAfter`,
  oldest-first), not enveloped.

---

## Transfers (money — Idempotency-Key required)

All require KYC-approved user, `money` rate limit, `Idempotency-Key`. Amount is
in the **source account** currency. Success → 201 with the transfer result
(`{ transferId, transactionId, status, fromBalanceAfter, toBalanceAfter, fee,
currency, alerts }`, money as strings). Declines → `402 INSUFFICIENT_FUNDS` or
`422 LIMIT_EXCEEDED` (and a `FAILED` transaction is recorded).

### POST `/api/transfers/internal`
Own-account transfer (same currency). Body: `{ fromAccountId, toAccountId, amount, note? }`.

### POST `/api/transfers/p2p`
Peer transfer. Body: `{ fromAccountId, toAccountId? | recipientEmail?, amount,
note?, counterparty?: { name?, country? } }`. If `recipientEmail` is given, the
recipient's first active same-currency account is resolved.

### POST `/api/transfers/bank`
External/bank sandbox (settles to `SETTLEMENT`; no `toAccountId`). Body:
`{ fromAccountId, amount, note?, counterparty: { name, ibanMasked?, bank?, country? } }`.

### POST `/api/transfers/fx`
Cross-currency conversion. Body: `{ fromAccountId, toAccountId, amount }` (accounts
must differ in currency). 201 → `{ data: { transactionId, reference, base, quote,
inputAmount, outputAmount, fee, rateScaled, effectiveRateScaled, scale, spreadBps } }`.

### GET `/api/transfers/{id}/receipt`
Requires user + ownership. Full receipt incl. ledger entries.
- 200 → `{ data: { id, reference, kind, amount, currency, fee, status, note,
  from, to, transaction, ledgerEntries[], createdAt } }`.

---

## Cards

### GET `/api/cards`
Requires user. Display-only card list (`last4`, brand, expiry, toggles, limits).
**No PAN ever exists.**
- 200 → `{ data: Card[] }`.

### POST `/api/cards`
Requires KYC-approved user. Issues a `VIRTUAL_DEBIT` card on an owned active
account (random `last4` + opaque `tokenRef`).
- Body: `{ accountId, cardholderName }`
- 201 → `{ data: Card }`.

### POST `/api/cards/{id}/freeze` · POST `/api/cards/{id}/unfreeze`
Requires user + ownership. Sets card `FROZEN`/`ACTIVE` (rejects if `CLOSED`).
- 200 → `{ data: { id, status } }`.

### PATCH `/api/cards/{id}/limits`
Requires user + ownership. Updates limits (parsed in the card account currency)
and toggles.
- Body (all optional): `{ dailyLimit, monthlyLimit, perTxLimit, atmDailyLimit
  (money strings), onlinePaymentsEnabled, atmEnabled, contactlessEnabled (bool) }`
- 200 → `{ data: { id, onlinePaymentsEnabled, atmEnabled, contactlessEnabled,
  limit: { dailyLimit, monthlyLimit, perTxLimit, atmDailyLimit } } }`.

### POST `/api/cards/{id}/simulate-purchase`
**Money — Idempotency-Key required.** Requires KYC-approved user, `money` rate
limit. Simulates an authorization (hold) or capture (settle). No card network.
- Body: `{ amount, merchantName, mcc(2–8), capture? = true }`
- 201 → `{ data: { transactionId, reference, status, holdStatus, amount, fee,
  currency, balanceAfter, availableAfter } }`.

---

## Analytics

All require user. Deterministic computations over the ledger; money as strings.

### GET `/api/analytics/spending`
Query: `currency` (KGS|USD|EUR, default KGS), `days` (≤365, default 30).
- 200 → `{ data: { currency, days, total, spendingByCategory: [{ categoryKey,
  label, color, amount, count }] } }`.

### GET `/api/analytics/cashflow`
Query: `currency`, `months` (≤24, default 6).
- 200 → `{ data: { currency, months, cashflow: [{ month, inflow, outflow, net }] } }`.

### GET `/api/analytics/budgets`
- 200 → `{ data: { budgets: [{ id, name, currency, limit, spent, pct, over }] } }`.

---

## AI assistant

All require user; rate-limited (`ai`). Ships with a **mock** provider.

### POST `/api/ai/chat`
Body: `{ conversationId?, message(1–2000) }`. Detects a skill
(spending/budget/fraud/support), grounds on the user's data, persists messages.
- 200 → `{ data: { conversationId, skill, content, grounding } }`.

### POST `/api/ai/spending-insight`
Body: `{ currency?: "KGS"|"USD"|"EUR" }`.
- 200 → `{ data: { content, grounding } }`.

### POST `/api/ai/risk-explanation`
Body: `{ transactionId(uuid) }` (must belong to the user).
- 200 → `{ data: { content, grounding } }`.

---

## Health

### GET `/api/health`
Public. Liveness + ledger-integrity probe. **Not enveloped.**
- 200 → `{ status: "ok", sandbox: true, time, db: "up", ledgerBalanced: boolean }`
- 503 → `{ status: "degraded", db: "down" }`.

---

## Admin

Admin endpoints require the admin session and a specific permission via
`requireAdmin(PERMISSIONS.X)`. List endpoints accept `take` (≤100), `skip`, and
filters; responses include `{ ..., total, take, skip }`.

### POST `/api/admin/login`
Public. Rate-limited (`auth`). Verifies an `AdminUser`, sets `nb_admin`, audits.
- Body: `{ email, password }`
- 200 → `{ data: { admin: { id, email, firstName, lastName } } }`; 401 on bad creds.

### POST `/api/admin/logout`
- 200 → `{ data: { ok: true } }`.

### GET `/api/admin/customers` — `customers.read`
Query: `q` (email/name search), `take`, `skip`.
- 200 → `{ data: { customers[], total, take, skip } }` (each with profile +
  current risk score).

### GET `/api/admin/customers/{id}` — `customers.read`
Full customer view: profile, accounts, cards (display-only), latest KYC, current
risk, recent AML alerts.
- 200 → `{ data: { ...customer } }`; 404 if not found.

### PATCH `/api/admin/customers/{id}` — `customers.write`
Block / unblock / suspend (audited + notifies the customer).
- Body: `{ action: "BLOCK"|"UNBLOCK"|"SUSPEND", reason }`
- 200 → `{ data: { id, status } }`.

### PATCH `/api/admin/kyc/{id}/review` — `kyc.review`
Approve/reject/return a KYC application. On first approval, provisions
KGS/USD/EUR accounts.
- Body: `{ decision: "APPROVED"|"REJECTED"|"IN_REVIEW", notes?, rejectionReason? }`
- 200 → `{ data: { id, status, decidedAt, createdAccounts[] } }`.

### GET `/api/admin/aml-alerts` — `aml.read`
Query: `status` (OPEN|REVIEWING|CLOSED), `level` (LOW|MEDIUM|HIGH|CRITICAL),
`take`, `skip`.
- 200 → `{ data: { alerts[], total, take, skip } }`.

### PATCH `/api/admin/aml-alerts/{id}` — `aml.write`
Update status/notes/assignment (audited). `CLOSED` sets `resolvedAt`.
- Body: `{ status?, adminNotes?, assignToSelf? }`
- 200 → `{ data: { id, status, assignedTo, adminNotes, resolvedAt } }`.

### GET `/api/admin/disputes` — `disputes.read`
Query: `status` (OPEN|INVESTIGATING|RESOLVED|REJECTED), `take`, `skip`.
- 200 → `{ data: { disputes[], total, take, skip } }`.

### PATCH `/api/admin/disputes/{id}` — `disputes.write`
Update a dispute; optional `refund` posts a compensating reversal transaction.
- Body: `{ status, resolution?, refund? }`
- 200 → `{ data: { id, status, resolution, handledBy, refund: { reversalId,
  originalId } | null } }`.

### GET `/api/admin/transactions` — `transactions.read`
Query: `status`, `type`, `userId`, `q` (reference/description/email), `take`, `skip`.
- 200 → `{ data: { transactions[], total, take, skip } }`.

### GET `/api/admin/risk-scores` — `risk.read`
Current risk scores. Query: `order` (asc|desc by score), `level`, `take`, `skip`.
- 200 → `{ data: { riskScores[], total, take, skip } }`.

### GET `/api/admin/audit-logs` — `audit.read`
Query: `action` (contains), `entity` (exact), `actorType` (USER|ADMIN|SYSTEM),
`take` (≤100, default 50), `skip`.
- 200 → `{ data: { logs[], total, take, skip } }` (includes `prevHash`/`hash`).
