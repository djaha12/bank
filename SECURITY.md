# Security — NEO BANK OS 2026

> **Sandbox notice.** This is a prototype, not a regulated bank. It uses mock
> auth, mock OTP delivery, mock screening, and an in-process rate limiter.
> Several controls described here are intentionally simplified for a single-
> instance demo; the **Known gaps for production** section lists what must be
> hardened before any real deployment.

Report issues responsibly — there is no production system to attack here, but
if you find a logic flaw in the ledger or auth code, please open an issue.

---

## 1. Threat model

### Assets
- **Ledger integrity** — balances must always reconcile to the append-only
  entries; no value created or destroyed except via explicit system accounts.
- **Customer data** — profile/KYC fields, transaction history.
- **Authentication state** — session tokens, OTP codes, admin sessions.
- **Audit trail** — tamper-evidence of who did what.

### Trust boundaries
1. **Browser ↔ server** — all input is untrusted; validated with Zod, authorized
   per request.
2. **Server ↔ database** — Prisma parameterizes queries; the one raw SQL
   (`SELECT … FOR UPDATE` in `ledger.ts`) uses `Prisma.join` over validated UUIDs.
3. **Customer ↔ admin planes** — separate cookies (`nb_session` vs `nb_admin`),
   separate guards, separate auth mechanisms.
4. **App ↔ external providers** — OTP and AI are behind adapters; only mock
   implementations ship.

### Primary adversaries / abuse cases
- A customer trying to read or move **another customer's** money/data.
- A customer trying to **double-spend** via request retries or races.
- A customer trying to transact **without completing KYC**.
- Credential stuffing / OTP brute force.
- An attacker trying to **forge or rewrite** the audit trail.
- An attacker attempting **money creation** (mint) or **unbalanced postings**.

### Key mitigations (summary)
| Threat | Mitigation | Where |
| --- | --- | --- |
| Cross-customer access | Every query filtered by `user.id`; ownership checks | route handlers + operations |
| Double-spend on retry | `Idempotency-Key` + `withIdempotency` | `src/lib/idempotency.ts` |
| Double-spend on race | Serializable tx + `SELECT … FOR UPDATE` row locks | `src/lib/ledger.ts` |
| Money creation / unbalanced posting | `assertBalancedPlan` (per-currency debit==credit) | `src/lib/ledger.ts` |
| Transacting without KYC | `requireKycApprovedUser()` on money ops | `src/lib/auth.ts` |
| Brute force | Per-bucket rate limits (`auth`/`otp`/`money`/`ai`) | `src/lib/ratelimit.ts` |
| Audit tampering | Hash-chained audit log + `verifyAuditChain()` | `src/lib/audit.ts` |
| Privilege escalation | RBAC permission checks per admin route | `src/lib/rbac.ts` |
| Injection | Zod validation + Prisma parameterization | `src/lib/validation.ts` |
| Info leakage | `fail()` maps errors to safe codes; no stack traces | `src/lib/api.ts` |

---

## 2. OWASP API Security Top 10 (2023) mapping

| Risk | Status in this codebase |
| --- | --- |
| **API1 Broken Object Level Authorization** | Mitigated. Every resource lookup re-checks `userId` ownership (e.g. `account.userId !== user.id → 404/403`); admin object access gated by permission. |
| **API2 Broken Authentication** | Partial. DB-backed customer sessions (hashed token cookie), admin JWT, OTP, rate-limited login. **Sandbox:** mock OTP delivery, scrypt (not argon2id), demo `SESSION_SECRET`. |
| **API3 Broken Object Property Level Authorization** | Mitigated. Responses are explicitly projected to safe fields (e.g. cards return `last4`, never PAN); Zod schemas whitelist writable input. |
| **API4 Unrestricted Resource Consumption** | Partial. Rate limiting + pagination caps (`take ≤ 100`). **Sandbox:** in-memory limiter (per-process). |
| **API5 Broken Function Level Authorization** | Mitigated. Admin endpoints require `requireAdmin(PERMISSIONS.X)`; customer money ops require KYC approval. |
| **API6 Unrestricted Access to Sensitive Business Flows** | Mitigated for money flows via idempotency + per-user money rate limit + risk engine. |
| **API7 Server Side Request Forgery** | N/A — the app makes no user-controlled outbound requests (AI/OTP are mock). Re-evaluate when wiring real providers. |
| **API8 Security Misconfiguration** | Mitigated. Secure headers in `next.config.mjs`, `poweredByHeader: false`, same-origin server actions, generic error bodies. |
| **API9 Improper Inventory Management** | Mitigated. Endpoints enumerated in [`API.md`](./API.md) + [`openapi.yaml`](./openapi.yaml); a single `route()` wrapper standardizes every handler. |
| **API10 Unsafe Consumption of APIs** | N/A in sandbox (no third-party APIs consumed). Provider adapters must validate responses when added. |

---

## 3. OWASP ASVS alignment (selected, L1/L2 intent)

| ASVS area | How it's addressed |
| --- | --- |
| **V1 Architecture** | Layered: thin handlers → domain operations → ledger; documented in `ARCHITECTURE.md`. |
| **V2 Authentication** | Hashed/peppered OTP (`hashOtp`), scrypt password hashing, OTP attempt cap (5), expiry; passkey-ready schema (`WebAuthnCredential`). |
| **V3 Session Management** | `httpOnly` + `sameSite=lax` + `secure` (prod) cookies; server-side session store with revocation/expiry; raw token never persisted. |
| **V4 Access Control** | Deny-by-default; ownership + RBAC checks on every protected route. |
| **V5 Validation/Encoding** | Centralized Zod schemas; strict money string regex; no `eval`/dynamic SQL. |
| **V7 Error/Logging** | Errors normalized; audit log for sensitive actions; OTP/PII not echoed in production. |
| **V8 Data Protection** | No real PAN/IBAN stored; only `last4` + opaque token ref; documents are sandbox references. |
| **V9 Communications** | HSTS header; cookies `secure` in production (deploy behind TLS). |
| **V11 Business Logic** | Idempotency + per-currency balanced postings + limits + holds. |
| **V13 API** | Consistent envelope, explicit content-types, method-scoped handlers. |

---

## 4. NIST Cybersecurity Framework (CSF) mapping

| Function | Examples in this project |
| --- | --- |
| **Identify** | Asset/data inventory (this doc + schema), documented trust boundaries. |
| **Protect** | AuthN/AuthZ, input validation, secure headers, least-privilege RBAC, secret handling guidance. |
| **Detect** | `LoginEvent` (incl. `suspicious`), risk engine + AML alerts, `/api/health` ledger-integrity probe, audit chain. |
| **Respond** | Admin can block/suspend customers, freeze cards, resolve disputes (with reversal), close AML alerts. |
| **Recover** | Reversals/refunds via compensating ledger entries; DB migrations + seed reproducibility; (prod: backups/DR — gap). |

---

## 5. Authentication, session & passkey-readiness

- **Passwords (sandbox):** `scrypt` (N=16384) with a per-hash salt, stored as
  `scrypt$N$salt$hash`, verified in constant time (`timingSafeEqual`). This is a
  **mock** — production should use **argon2id + a KMS-held pepper**, or prefer
  passkeys.
- **OTP:** 6-digit code, HMAC-SHA-256 **peppered** with `SESSION_SECRET` before
  storage; 5-attempt cap; TTL via `OTP_TTL_SECONDS`. `OTP_PROVIDER=mock` logs
  the code to the console and returns it as `devCode` **only when
  `NODE_ENV !== "production"`**.
- **Customer sessions:** random 32-byte token in an `httpOnly` cookie; the DB
  (`DeviceSession`) stores `sha256(token)`, supporting device listing, trust
  flags, last-seen, expiry, and revocation.
- **Admin sessions:** stateless HS256 JWT (`jose`) signed with `SESSION_SECRET`,
  short-lived (`SESSION_TTL_HOURS`), in a separate `nb_admin` cookie.
- **Passkey-ready:** `WebAuthnCredential` model is present (credentialId,
  publicKey, counter) so a WebAuthn ceremony can be added behind an adapter.

---

## 6. Authorization (RBAC)

- **Permissions** (`src/lib/rbac.ts` `PERMISSIONS`): fine-grained capability
  keys such as `kyc.review`, `aml.write`, `transactions.read`, `audit.read`.
- **Roles** bundle permissions: `super_admin` (all), `compliance_officer`
  (KYC/AML/risk/audit), `support_agent` (customers/disputes).
- Permissions/roles are **seeded into the DB** (`Role`/`Permission`/
  `RolePermission`/`AdminUserRole`) so they're manageable at runtime, with the
  code object as the source of truth for the seed.
- Every admin handler calls `requireAdmin(PERMISSIONS.X)`; missing permission →
  `403 FORBIDDEN`.
- Customers are confined to their own data; money/card-issuance ops also require
  `requireKycApprovedUser()`.

---

## 7. Idempotency

Money-movement endpoints require an `Idempotency-Key` header (8–200 chars,
enforced by `getIdempotencyKey`) and execute inside `withIdempotency`
(`src/lib/idempotency.ts`):

- First call: creates an `IdempotencyKey` row (`IN_PROGRESS`), runs the handler,
  stores `{responseCode, responseBody, transactionId}` and marks `COMPLETED`.
- Retry with the **same body** → replays the stored response (no re-posting).
- Retry with a **different body** (hash mismatch) → `422`.
- Concurrent in-flight retry → `409`.
- Handler failure deletes the key so the client may retry cleanly.
- Keys expire after 24h. The request body is hashed (`sha256` of canonical JSON)
  to detect key reuse with altered payloads.

The domain operation itself runs in a **Serializable** `prisma.$transaction`, so
idempotency and DB-level serialization together prevent double-posting.

---

## 8. Rate limiting

`src/lib/ratelimit.ts` — fixed-window counter with per-bucket configs:

| Bucket | Limit |
| --- | --- |
| `auth` (login/register/admin login) | 10 / min |
| `otp` (request / verify) | 5–10 / min |
| `money` (transfers, fx, card purchase) | 30 / min (keyed by user id) |
| `ai` (chat/insight/explanation) | 20 / min (keyed by user id) |
| default | 100 / min |

`enforceRateLimit` throws `429 RATE_LIMITED` with a `retryAfterMs` hint.
**Sandbox limitation:** the limiter is **in-process** (per-instance). Production
must use a shared store (e.g. Redis) behind the same interface.

---

## 9. Input validation (Zod)

- All request bodies are parsed via `parseBody(req, schema)` using schemas in
  `src/lib/validation.ts`. `ZodError` is mapped to `422 VALIDATION_ERROR` with a
  flattened `details` object.
- Money arrives as **decimal strings** (`moneyString`: `^\d{1,15}(\.\d{1,2})?$`,
  must be > 0) and is converted to BigInt minor units server-side
  (`toMinorUnits`) — floats never touch money math.
- UUIDs, emails, enums, and field lengths are all constrained; unknown
  properties are dropped by the schemas.

---

## 10. Secure headers & transport

Set globally in `next.config.mjs` (`headers()` applies to `/:path*`):

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-DNS-Prefetch-Control: off`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

Also: `poweredByHeader: false`, and Server Actions restricted to
`allowedOrigins: ["localhost:3000"]` (tighten per environment). A strict
**Content-Security-Policy is noted as TODO** in `next.config.mjs` and should be
added (with appropriate `connect-src`/`img-src`) when wiring real providers.

---

## 11. Audit hash-chain (tamper-evidence)

`src/lib/audit.ts`:

- Each `AuditLog` row stores `prevHash` and
  `hash = sha256(prevHash + canonicalJson(payload))`, forming a chain. Editing
  any earlier row breaks every later hash.
- `verifyAuditChain()` recomputes the chain and returns the first broken row id.
- Sensitive actions (login, transfer, kyc review, card freeze, admin block,
  dispute resolution, etc.) are recorded with actor, entity, before/after, IP,
  and user-agent.
- **Known limitation (documented in code):** under high concurrency the global
  chain can fork (two writers read the same `prevHash`). Production should use a
  monotonic sequence + **WORM** storage.

---

## 12. PCI principles (no PAN)

- **No real Primary Account Numbers are ever generated, stored, or logged.**
  `Card` holds only a display `last4`, a `brand` (`NEO`), expiry, and an opaque
  `tokenRef` placeholder (mimicking a network token like VTS/MDES).
- No CVV, no full PAN, no track data anywhere in the schema or logs.
- This keeps the sandbox **out of PCI-DSS scope by construction**. A real
  product would tokenize via a PCI-compliant vault/processor to stay out of (or
  minimize) scope.

---

## 13. Secrets handling

- Secrets come from environment variables (`SESSION_SECRET`, future
  `AI_API_KEY`). `.env*` files are git-ignored; `.env.example` contains **no
  real secrets**.
- Generate a real session secret with `openssl rand -hex 32`. **Never** reuse
  the example/Docker placeholder in a deployed environment.
- `SESSION_SECRET` doubles as the OTP pepper and admin-JWT signing key in the
  sandbox; production should separate these and store them in a **KMS/HSM**.

---

## 14. Known gaps for production

These are deliberate sandbox simplifications — **fix before any real use**:

1. **Auth:** scrypt → **argon2id + KMS pepper**, or move to passkeys; real OTP
   delivery; do not return `devCode`; enforce email verification.
2. **Rate limiting:** in-memory → **Redis/distributed** store.
3. **Audit:** chain can fork under concurrency → monotonic sequence + **WORM**
   storage / append-only ledger DB.
4. **CSP:** add a strict Content-Security-Policy.
5. **Screening:** sanctions/PEP screening is a hardcoded placeholder
   (`SANDBOX-DEMO-LIST`, always `CLEAR`) → licensed provider with maintained
   lists (see `COMPLIANCE.md`).
6. **Secrets:** separate signing keys, rotate, store in KMS/HSM.
7. **Transport:** enforce TLS everywhere; cookies `secure` requires HTTPS.
8. **Money creation:** the `DEMO_DEPOSIT`/`FUNDING` path mints play money and is
   seed-only — it must **never** be exposed in production.
9. **Testing:** independent **penetration test**, fuzzing, and a full secure-SDLC
   (SAST/DAST/dependency scanning) before launch.
10. **Reliability/forensics:** backups, DR, immutable logs, monitoring/alerting,
    and reconciliation jobs.
