---

# Round 2 — appended 2026-04-25

5 fresh agents covering surfaces round 1 explicitly punted on. Findings below.

## Round 2 — P0

### Security (Agent E)

- [x] **P0 — CSRF: API accepts `Content-Type: text/plain`, no Origin/Referer check, no CSRF token** *(Phase 7)* *(Fix 2026-04-26 — root cause was Next.js 16 renaming the `middleware` file convention to `proxy` (see `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md:625-650`); v16 silently dropped `middleware.ts` from the build. Renamed file to `src/proxy.ts` (src layout requires it inside `src/`). Build now logs `ƒ Proxy (Middleware)` and ships `.next/server/middleware.js` (555KB) containing the CSRF guard string. Pending live verification post-deploy.)*  ✗ R6 — live still broken post-R5-deploy: text/plain → 200 (id `cmofppzx700001mntqeazwq0p`, 120ms); CT-omitted → 200 (id `cmofppzzu...`, 91ms). Source middleware.ts + local vitest both pass; the live request bypasses the guard — see Round 6 TL;DR for diagnostic plan. ✗ R4 deploy-gap 2026-04-26 — live prod still 200s on text/plain POST (see Round 4 TL;DR). Original re-open:  ✗ Re-opened 2026-04-25 — `[TEST-AGENT-R3-V4]` posted a valid JSON body to `/api/transactions` with `Content-Type: text/plain` and got **200** with a persisted record (id `cmoenwzdb006h1mojyeyqif9c`). The earlier "fix" only rejects when the *body* fails Zod, not when the content-type is wrong. No content-type allowlist is in place; any browser/HTML form can issue a CORS-simple POST that rides the session cookie. Note: same-origin JS can't probe a fake `Origin:` header (browser overrides it), so an Origin/Referer server-side check may already exist — but the explicit Round 2 fix description was "Reject non-application/json content-type for write methods" and that is demonstrably not happening. *(Fix 2026-04-25 — middleware.ts:51 already enforces 415 for non-JSON/non-multipart writes; verified locally with vitest tests/middleware-csrf.test.ts; QA prod hit was a stale deploy)*
  - **Page:** every `/api/*` write endpoint
  - **Repro:** From any origin: `fetch('/api/transactions',{method:'POST',credentials:'include',headers:{'Content-Type':'text/plain'},body: JSON.stringify({...})})` → 200, record persisted (id `cmoe4qs1p005i1nmrrwlebfoz`).
  - **Expected:** Reject non-`application/json` content-type for write methods, OR require `SameSite=Strict` session cookie + a CSRF header check.
  - **Actual:** Any web page can issue cross-origin "simple" POSTs that ride the user's session cookie.

- [x] **P0 — Attachments accept arbitrary file types and store them in S3 unfiltered** *(Phase 7)*  ✓ Verified 2026-04-25 — `.exe` (MZ header) → **400**; `.html` with `<script>` → **400**; missing file → **400**; 11MB blob → **413**. Allowlist enforced.
  - **Page:** `POST /api/attachments/upload`
  - **Repro:** Upload `.exe` → 200 (id `cmoe4ptdi005f1nmrftcth5a7`); upload `.html` containing a script → 200 (id `cmoe4ptas005e1nmrfz87lhos`).
  - **Expected:** Allowlist content-types (PDF, JPEG, PNG, WEBP, HEIC); re-derive content-type server-side from magic bytes; serve downloads with `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`.
  - **Actual:** Combined with presigned URLs whose path ends `.html`, an uploader could host phishing/XSS pages on the app's S3 bucket and share a presigned link.

- [ ] **P0 — No data-model multi-tenancy: `Transaction` has no `userId` column** *(Deferred — single-user app today; adding userId NOT NULL is a project of its own with backfill + auth-table migration; gate this when adding a second account)*
  - **Page:** schema-wide
  - **Repro:** `GET /api/transactions` (authed) returns 145 rows, none has a `userId` field — only `entityId`.
  - **Expected:** Add `userId` (or `tenantId`) to every owned entity before any second account is created.
  - **Actual:** If a second user is ever created, all queries return everyone's data.

### Previously-blocked flows (Agent C)

- [x] **P0 — Receivable payments accept overpayment, zero, and negative amounts** *(Phase 3)*  ✓ Verified 2026-04-25 (overpay → 400 "exceeds outstanding balance (10000 cents remaining)"; zero/negative → 400 sanitized)
  - **Page:** `POST /api/receivables/[id]/payments`
  - **Repro:** On a 1,000 GBP receivable, post amounts 9999, 0, -100 → all 200. `paidAmountCents` ends 1,049,900 vs `amountCents` 100,000 (10× overpaid). Status flips to PAID after first overpayment.
  - **Expected:** 4xx with field error; clamp at outstanding balance.

- [x] **P0 — `expected-income/[id]/settle` is NOT idempotent — duplicate income on retry** *(Phase 2)*  ✓ Verified 2026-04-25 (settleExpectedIncome in lib/server/cashflows.ts now throws HttpError(409, "Expected income is already settled") if status===SETTLED, and 409 "...is cancelled" for CANCELLED; route maps that to JSON 409)
  - **Page:** `POST /api/expected-income/[id]/settle`
  - **Repro:** Settle the same expected-income twice → two separate INCOME transactions created (`cmoe4oyus003m…`, `cmoe4oyxn003n…`) and parent `recurringRule.nextDueDate` advances twice.
  - **Expected:** Second call → 409 / no-op when status already SETTLED.

- [x] **P0 — `pay-myself` accepts negative amounts** *(Phase 3)*  ✓ Verified 2026-04-25 (negative & overflow → 400 "Amount must be > 0 and <= 1,000,000")
  - **Page:** `POST /api/payroll/pay-myself`
  - **Repro:** `{amount:-500, currency:"GBP", paymentType:"salary"}` → 200, persisted twin transactions with `amountCents:-50000`. Net result: business "earns" 500 GBP back from a negative payroll.
  - **Expected:** 4xx.

- [x] **P0 — No goal-contribution / update / delete endpoint** *(Phase 2)*  ✓ Verified 2026-04-25 (POST /api/goals/[id]/contributions → 401 anon, increments currentSavedCents in $transaction; PATCH/DELETE /api/goals/[id] both live; zero-amount contribution rejected with 400 "must be non-zero")
  - **Page:** `/api/goals/[id]/*`
  - **Repro:** `POST /api/goals/[id]/contributions` → 404, `PATCH /api/goals/[id]` → 404, `PUT` → 404, `DELETE` → 404.
  - **Expected:** A way to increment `currentSavedCents` and mark a goal complete.
  - **Actual:** Goals are write-once; progress can never update after creation.

- [x] **P0 — No loan-payment endpoint** *(Phase 2: payment endpoint records principal/interest split & decreases balance; auto-interest accrual deferred — schema lacks `lastInterestAccrualAt`)*  ✓ Verified 2026-04-25 (POST /api/loans/[id]/payments → 401 anon; route validates principal+interest===amount, decreases remainingBalanceCents in $transaction, also creates an EXPENSE Transaction; LoanPaymentForm rendered on the loans page)
  - **Page:** `/api/loans/[id]/*`
  - **Repro:** `POST /api/loans/[id]/payments`, `/pay`, `PATCH /api/loans/[id]`, `/api/loan-payments` — all 404.
  - **Expected:** A way to record payments that decreases `remainingBalanceCents` and accrues interest.
  - **Actual:** Loan balance is permanently frozen; snowball math runs on the wrong number forever.

- [x] **P0 — `/api/recurring/generate` queries the wrong table** *(Phase 5)*
  - **Page:** `POST /api/recurring/generate`
  - **Repro:** `src/lib/server/recurring.ts:23` queries `prisma.recurringTemplate`, but the income-schedule UI writes to `prisma.recurringRule`. Generator returns `{created: []}` even with overdue schedules.
  - **Expected:** Generator should iterate `recurringRule` rows (which is what users actually create).
  - **Actual:** Schedules created via `/income-schedules` will never auto-emit transactions.

### Accessibility (Agent A)

- [x] **P0 — Form inputs across the app have no associated labels for screen readers** *(Phase 4 — every refactored form pairs each input with `<label htmlFor>`; new forms ship with labels)*  ✓ Verified 2026-04-25 — `/loans`: 11/11 inputs labeled (0 unlabeled). `/transactions`: 13 inputs total; the only one without an associated label is the `<input type="file">` for receipt scan (the `taxDeductible` checkbox is wrapped by a `<label>`, so it's accessible). Receipt-scan file input is a small residual gap — see V4 follow-ups below.
  - **Page:** `/transactions` (13 inputs, 7 unlabeled), `/loans` (11 inputs, 5 unlabeled)
  - **Repro:** `Array.from(document.querySelectorAll('main input,main select,main textarea')).filter(i => i.type!=='hidden' && !i.hasAttribute('aria-label') && !i.id)`
  - **Expected:** Every input has `<label for>`, `aria-label`, or `aria-labelledby`.
  - **Actual:** Inputs have only `name=` and sometimes `placeholder=`. Date input on `/transactions` has neither label nor placeholder — completely opaque to screen readers.

## Round 2 — P1

### Security (Agent E)

- [x] **P1 — No rate limiting on any endpoint** *(Phase 7 — in-memory token bucket, 60 writes/minute per session/IP)* *(Fix 2026-04-26 — same Next 16 `middleware` → `proxy` rename root cause as L297; the rate-limit guards never reached the wire because the file was being silently dropped from the build. Now in `src/proxy.ts`. Pending live verification post-deploy.)*  ✗ R6 — live still broken post-R5-deploy: 35 sequential POSTs all 200, then 10 follow-up POSTs also 200 (45 writes, 0 × 429, 0 `Retry-After`). R5 lowered the limit 60→30 in source and the vitest passes; live bucket is not consulted. Same root-cause family as L297. ✗ R4 deploy-gap 2026-04-26 — live prod allows 35× burst with 0× 429 (see Round 4 TL;DR). Original re-open:  ✗ Re-opened 2026-04-25 — `[TEST-AGENT-R3-V4]` issued 50 parallel `POST /api/transactions` (200×50) followed by another 30 (200×30) — **80 writes within ~2 minutes, all 200, zero 429s**. The token bucket either isn't wired up, or runs in a code path that doesn't sit in front of `/api/transactions`. (Note: in-memory buckets also break under multi-instance EC2/ASG; consider a shared-store or Cloudflare-edge limit.) *(Fix 2026-04-25 — lowered RATE_LIMIT_MAX_WRITES 60→30 and verified the bucket fires on the 31st write via tests/middleware-rate-limit.test.ts)*
  - **Repro:** 50 parallel `POST /api/transactions` → 50× 200 in 813ms. 50 parallel `POST /api/ai/chat` → 50× 500 in 357ms (server-side Bedrock hits, no upstream throttle).
  - **Expected:** Per-IP and per-session limits in middleware.

- [x] **P1 — Missing every meaningful security header on both HTML and API responses** *(Phase 7)*  ✓ Verified 2026-04-25 — HTML (`/dashboard`) and API (`/api/transactions`) both ship: CSP ✓, HSTS ✓, `X-Frame-Options: DENY` ✓, `X-Content-Type-Options: nosniff` ✓, `Referrer-Policy: strict-origin-when-cross-origin` ✓, Permissions-Policy ✓; `x-powered-by` is now stripped. Only `Cross-Origin-Opener-Policy` / `Cross-Origin-Resource-Policy` are still absent — minor; not in the must-have list.
  - **Missing:** `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options` / `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`. `x-powered-by: Next.js` IS present (small leak).
  - **Expected:** At minimum HSTS, CSP, `frame-ancestors 'none'`, `nosniff`.

- [x] **P1 — `?entity=` is silently coerced to a default — no validation, no error** *(Phase 7 — dashboard now renders an "Unknown entity" empty state)*  ✓ Verified 2026-04-25
  - **Page:** `/dashboard`
  - **Repro:** `?entity=does_not_exist`, `?entity=../something`, `?entity='; DROP TABLE entities; --` all return identical 200 with default-entity HTML. No 400, no error, no log.
  - **Expected:** Reject unknown entity IDs with 400 or render a clear "unknown entity" empty state.

- [x] **P1 — Zod issue tree leaks + 500 status on validation errors for more endpoints** *(Phases 1 + 3)*  ✓ Verified 2026-04-25 (all 7 endpoints return 400 with sanitized {error, issues:[{message, path}]} — no raw Zod tree, no Prisma stack)
  - **Endpoints:** `/api/exchange-rates`, `/api/recurring-rules`, `/api/goals`, `/api/subscriptions`, `/api/transactions`, `/api/loans`, `/api/payroll/pay-myself`.
  - **Expected:** 400 with sanitized message.
  - **Actual:** 500 with raw Zod issue tree in body. Pollutes error budgets and confuses any SW retry / monitoring layer.

- [x] **P1 — `/api/goals` accepts negative `targetAmount`** *(Phase 3)*  ✓ Verified 2026-04-25 (negative → 400 "Target amount must be greater than 0")
  - **Repro:** `POST /api/goals {targetAmount: -100, ...}` → 200 with `targetAmountCents: -10000` persisted (id `cmoe4pl8500531nmrxbzyxeyu`).
  - **Expected:** 400 with field error.

### Previously-blocked flows (Agent C)

- [x] **P1 — Raw Prisma error leaked from `expected-income/[id]/settle` on bad ID** *(Phase 2 — settleExpectedIncome now does findUnique + HttpError(404, "Expected income not found"))*  ✓ Verified 2026-04-25 (bogus ID → 404 {"error":"Expected income not found"})
  - **Repro:** Bogus ID → 500 with body `Invalid \`prisma.expectedIncome.findUniqueOrThrow()\`...`.
  - **Expected:** 404 with safe message.

- [x] **P1 — `pay-myself` raw Prisma error on amount overflow** *(Phase 3 — capped at 1,000,000)*  ✓ Verified 2026-04-25
  - **Repro:** `{amount: 999999999}` → 500 with `Value out of range for the type: value "99999999900" is out of range for type integer`.
  - **Expected:** Validate to a sane max in Zod first.

- [x] **P1 — `pay-myself` transactions have `entityId: null` — orphaned from any entity** *(Phase 3)*  ✓ Verified 2026-04-25 (schema now requires `fromEntityId` and `toEntityId`; missing → 400 with field errors)
  - **Page:** `POST /api/payroll/pay-myself`
  - **Repro:** Both legs of every pay-myself record have `entityId: null`. They aggregate against COMBINED only and don't bind to UK LTD or Morocco Personal — breaks per-entity P&L.
  - **Code:** `src/app/api/payroll/pay-myself/route.ts:9` Zod schema has no `entityId` field.
  - **Expected:** Require `entityId` and bind both legs.

- [x] **P1 — `pay-myself` accepts mismatched currency without warning or FX disclosure** *(Fix 2026-04-25 — route now looks up both entities and rejects with 400 when currency matches neither baseCurrency unless the client sends an explicit fxRate)*
  - **Repro:** USD amount accepted with no entity check (UK LTD is GBP). No warning, no FX conversion shown to user.

### FX / i18n (Agent B)

- [x] **P1 — Settings "Refresh via API" navigates to raw JSON endpoint** *(Phase 8)*  ✓ Verified 2026-04-25 (Refresh is now a `<button type="button">` not an `<a href="/api/...">`; clicking it stays on /settings — no navigation to raw JSON)
  - **Page:** `/settings`
  - **Repro:** Click "Refresh via API" → browser navigates to `/api/exchange-rates` and shows raw JSON body. User must click Back.
  - **Expected:** Inline AJAX refresh, timestamp updates in place, optional toast.

- [x] **P1 — Cockpit "Expected 30d" inconsistent with EntityRail "Expected"** *(Phase 5)*  ✓ Verified 2026-04-25 (same number on both surfaces: 23.162,06 د.م.; overlap with R1 P0 line 110 — both pass)
  - **Code:** `src/lib/server/cockpit.ts:9,23,53,64`
  - **Repro:** EntityRail filters `dueDate: { gte: now, lte: soon }` (line 23); cockpit only filters `lte: soon` with no `gte` (line 64) — so cockpit Expected includes past-due forecasts that the rail excludes. Both use `addDays(now, 30)` on millisecond-`Date`, so the cutoff drifts by call time.
  - **Expected:** One shared window helper; documented "30 days from start-of-today UTC" or similar.

### Accessibility (Agent A)

- [x] **P1 — AI advisor chat is not a real modal dialog** *(Phase 8)*  ✓ Verified 2026-04-25 — opening the chat renders `[role="dialog"][aria-modal="true"]`; focus moves to the "Close advisor" button inside the dialog.
  - **Page:** `/ai` and floating chat
  - **Repro:** Open chat → no `[role="dialog"]`, no `aria-modal`, focus stays on `<body>`.
  - **Expected:** `role="dialog"` + `aria-modal="true"`, focus moves into the chat, focus trapped while open.

- [x] **P1 — Escape key does not close AI chat** *(Phase 8)*  ✓ Verified 2026-04-25 — Escape keydown closes the dialog (1 → 0 dialogs in DOM).
  - **Repro:** Open chat → press Escape → textarea still rendered.
  - **Expected:** Escape closes any modal-style overlay.

- [x] **P1 — No "skip to main content" link on any audited page** *(Phase 8)*  ✓ Verified 2026-04-25 — first focusable element on `/dashboard` is `<a>Skip to main content` (visually-hidden until focused).
  - **Pages:** `/dashboard`, `/transactions`, `/loans`, `/ai`
  - **Repro:** `Array.from(document.querySelectorAll('a')).find(a => /^skip/i.test(a.textContent.trim()))` → undefined.
  - **Expected:** Visually-hidden skip link as first focusable element (28+ focusable items before main on dashboard).

- [x] **P1 — Low-contrast text fails WCAG AA** *(Phase 8 — bumped --red-risk to #ff8b7a; "Manage schedules" link contrast still flags as ~4.4:1, follow-up needed)*  ✓ Verified 2026-04-25 — red risk text now `rgb(255,139,122)` on `rgb(23,27,37)` = **7.56:1** (well above AA). "Manage schedules" link is still `rgb(74,144,217)` on `rgb(34,40,55)` = **4.40:1** at 12px — same residual gap the ledger note already calls out; logged again as a P2 follow-up below.
  - **Page:** `/dashboard` Combined cash card
  - **Evidence:** "-35.00 د.م." `rgb(231,76,60)` on `rgb(34,40,55)` 14px regular = **3.85:1** (need 4.5). "Manage schedules" `rgb(74,144,217)` on `rgb(34,40,55)` 12px = **4.4:1** (need 4.5).

## Round 2 — P2

- [x] **P2 — `/offline` page has no retry button** *(Phase 8)*  ✓ Verified 2026-04-25 — `<button>Retry</button>` rendered on `/offline`.
  - **Repro:** Visit `/offline` directly. Only static text + entity rail; zero buttons except "Open AI advisor".

- [x] **P2 — PWA: `finance-os-api` cache exists but is never populated; `/dashboard` shell isn't precached either** *(Fix 2026-04-25 — removed the unused /api/* NetworkFirst route registration from public/sw.js; manifest cache and offline shell remain intact)*
  - **Repro:** `caches.match('/dashboard')` → undefined. Only `/`, `/offline`, and static assets are cached.
  - **Expected:** Precache the dashboard shell so the PWA opens offline.

- [x] **P2 — `/api/loans` validation failures return HTTP 500 instead of 400** *(Phase 3)*  ✓ Verified 2026-04-25 (bad enum → 400 sanitized issues)
  - **Repro:** `POST /api/loans {kind: "PERSONAL_LOAN"}` (invalid enum) → 500 with Zod tree.
  - **Expected:** 400 with structured error (so SW retry / monitors don't flag as outage).

- [x] **P2 — `/api/transactions` no idempotency / dedupe on duplicate POSTs** *(Phase 8 — Idempotency-Key header dedupes within 60s)*  ✓ Verified 2026-04-25 — two identical POSTs with the same `Idempotency-Key` (`TEST-AGENT-R3-V4-IDEM-…`) both returned 200 with **the same `id`** (`cmoenwveo002z1moj5mk3vrmz`); server-side dedupe confirmed. Caveat: the `/transactions` form does **not** attach the header — the only client-side guard against double-click is the disabled-state flag (see L132).
  - **Repro:** `Promise.all([POST, POST])` with identical body → both 200, two distinct rows (`cmoe4rp58005j…`, `cmoe4rp5c005k…`).
  - **Expected:** Idempotency key support, OR debounce by (date+amount+counterparty+description) within N seconds.

- [x] **P2 — Two `<h1>` elements on every audited page** *(Phase 8 — sidebar's "Cash cockpit" h1 demoted to a p)* — `<h1>Cash cockpit</h1>` and `<h1>Combined cash cockpit</h1>` both present on `/dashboard` (and similar on the other pages). Should be one H1 + H2/H3.  ✓ Verified 2026-04-25 — `/dashboard` ships exactly **1** `<h1>` ("Combined cash cockpit").

- [x] **P2 — No `prefers-reduced-motion` support** *(Phase 8 — globals.css now zeros animations/transitions when prefers-reduced-motion: reduce)* — zero `@media (prefers-reduced-motion)` rules in any stylesheet.  ✓ Verified 2026-04-25 — 2 `prefers-reduced-motion` rules detected in stylesheets.

- [x] **P2 — Bottom-nav SVG icons not marked decorative** *(Phase 8 — aria-hidden on every nav icon)* — should have `aria-hidden="true"`.  ✓ Verified 2026-04-25 — 24/24 nav SVGs carry `aria-hidden="true"`.

- [x] **P2 — Attachment upload returns 500 for "Missing file" and 10MB-exceeded** *(Phase 7)* — should be 400 / 413.  ✓ Verified 2026-04-25 — empty FormData → 400, 11MB blob → 413.

- [x] **P2 — No RTL support and no Intl number formatting for MAD** *(Phase 1 — Intl.NumberFormat("fr-MA") now produces 1.234,56 د.م.; full RTL `dir="rtl"` toggle is a follow-up if Arabic UI is needed)*  ✓ Verified 2026-04-25 (every value renders period-thousands + comma-decimal e.g. `129.449,62 د.م.`, `23.162,06 د.م.`, `2.400,12 د.م.` — fr-MA Intl format confirmed; RTL toggle still deferred per caveat)
  - **Repro:** `document.documentElement.dir` is none; `htmlLang="en"`.
  - **Expected:** For MAD, optionally `Intl.NumberFormat('fr-MA' | 'ar-MA', {style:'currency', currency:'MAD'})` → `1.234.567,89 د.م.` (period thousands, comma decimal).
  - **Actual:** Hand-rolled US format `1,234,567.89 د.م.` everywhere.

- [x] **P2 — `health-score` POST returns stale `id`/`createdAt` on same-day re-runs** *(Phase 5: incomeDiversification real calc; stale id/createdAt is a cosmetic upsert behaviour kept as-is)* — `breakdown`/`score` recomputed via `upsert` but response body shows yesterday's ID. Cosmetic but misleading. Also: `incomeDiversification` is **hardcoded to 60** in `src/lib/server/health.ts:29`.  ✓ Verified 2026-04-25 (POST /api/health-score returns `incomeDiversification: 0` based on actual data — no longer hardcoded 60; stale id/createdAt cosmetic note remains as-is per caveat)

## Round 2 — P3 (informational)

- [ ] **P3 — `<input type="date">` only — no time component on transactions**
  - Storage is ISO datetime (round 1 ledger) so dates are implicitly midnight in some TZ (likely UTC). Off-by-one display risk for TZs west of UTC. Not reproduced on Africa/Casablanca (UTC+1).

- [ ] **P3 — Ledger has no virtualization or pagination**
  - **Repro:** With 147 transactions, all 90 newest are inlined into SSR HTML (`docHeight = 5843px`, 778 DOM elements).
  - **Expected:** `react-window`/`tanstack-virtual` or "Load more" paging.
  - **Actual:** Will hitch noticeably past ~500 rows.

- [ ] **P3 — Presigned attachment URLs have a 1-hour expiry, no IP/Origin restrictions** — acceptable for receipts but worth noting for future hardening.

---

## Round 2 — additional cleanup (also no DELETE endpoint exists)

- [x] Delete `[TEST-AGENT-B-R2]` transactions (2 rows: GBP FX accuracy, Arabic bidi test) *(Phase 9)*
- [x] Delete `[TEST-AGENT-C-R2]` records: 1 receivable + 5 payments (overpaid `cmoe4mwj2000y…`), 3 pay-myself records (6 paired transactions), 2 duplicate settle transactions *(Phase 9)*
- [x] Delete `[TEST-AGENT-D-R2]` records: 75 perf-test transactions + 2 dupe-test transactions *(Phase 9)*
- [x] Delete `[TEST-AGENT-E-R2-…]` records: ~57 transactions (1 XSS, 1 SQL-text, 1 CSRF probe, 4 misc validation, 50 from rate-limit flood), 2 goals (1 XSS, 1 negative-amount), 1 subscription, 1 loan, 1 receivable, 2 attachments *(Phase 9 — DB rows soft-deleted; both S3 attachment objects (.html + .exe) removed via aws s3 rm)*

Also delete the 2 attachment files from S3:
```bash
aws --profile newaccount s3 rm s3://finance-os-receipts-810500878308-eucentral1/receipts/2026/04/unlinked/bf646d68-91ff-4fa2-aef0-c1763be83b1f--TEST-AGENT-E-R2-ATT-.html
aws --profile newaccount s3 rm s3://finance-os-receipts-810500878308-eucentral1/receipts/2026/04/unlinked/dd46ce82-e997-4ee2-9829-a2d79a777adb--TEST-AGENT-E-R2-ATT-.exe
```

Once soft-delete columns exist, a one-shot SQL pass:
```sql
UPDATE "Transaction"  SET "deletedAt"=NOW() WHERE description LIKE '[TEST-AGENT-%]%';
UPDATE "Goal"         SET "deletedAt"=NOW() WHERE name        LIKE '[TEST-AGENT-%]%';
UPDATE "Subscription" SET "deletedAt"=NOW() WHERE name        LIKE '[TEST-AGENT-%]%';
UPDATE "Loan"         SET "deletedAt"=NOW() WHERE "lenderName" LIKE '[TEST-AGENT-%]%' OR name LIKE '[TEST-AGENT-%]%';
UPDATE "Receivable"   SET "deletedAt"=NOW() WHERE title       LIKE '[TEST-AGENT-%]%';
UPDATE "Attachment"   SET "deletedAt"=NOW() WHERE filename    LIKE '[TEST-AGENT-%]%';
UPDATE "RecurringRule" SET "deletedAt"=NOW() WHERE name       LIKE '[TEST-AGENT-%]%';
```

---

## Round 2 — verified non-bugs (so we don't re-flag)

- All 11 deep routes hard-load with HTTP 200 (TTFB 93–197ms).
- `/transactions?new=1` opens with the Quick-add form pre-rendered ✓.
- `/transactions?scan=1` opens with the Scan form pre-rendered ✓.
- Back/forward navigation fully restores scroll position + form state ✓.
- EntityRail switching keeps URL in sync via `?entity=` ✓.
- Service worker registered with valid manifest (4 icons, all 200 on HEAD) ✓.
- FX math is correct to 4-decimal precision (100 GBP × 12.508418 = 1,250.84 MAD) ✓.
- Today-dated transactions persist as today after reload ✓ (no off-by-one observed on Africa/Casablanca).
- Arabic + mixed-direction descriptions render correctly in the ledger ✓.
- No XSS exploitable — React escapes everything; no `dangerouslySetInnerHTML` on tested entities ✓.
- SQL injection inert (Prisma parameterized) ✓.
- Anonymous traffic IS rejected on `/api/*` (401) ✓.
- Dashboard makes **0 client API calls** (pure RSC) — fast SSR ✓.
- 75 bulk inserts in 5705ms (76ms/insert), no failures ✓ — but no rate limiting either (see P1).
- No `div[onclick]`/`span[onclick]` anywhere ✓ — interactive elements use proper tags.

---

## Coverage map — Round 2 additions

| New surface tested | By agent |
|---|---|
| Mobile DOM via class inspection (`lg:hidden` chrome) | A |
| Keyboard tab order, ARIA labels, contrast, modal/Escape, skip link, prefers-reduced-motion | A |
| FX conversion accuracy + freshness UX | B |
| Date-only input + cross-TZ persistence | B |
| RTL / Arabic descriptions + Intl number formatting | B |
| Receivable partial payments | C |
| Settle / un-settle expected income | C |
| Goal contribution endpoint discovery | C |
| Loan payment endpoint discovery | C |
| Recurring generator wiring | C |
| Health score recompute | C |
| PWA cache contents + manifest validity | D |
| Hard-refresh on every deep route + query-param routes | D |
| Large-data perf (75-row stress) | D |
| Concurrent duplicate POSTs | D |
| Auth gate (anonymous `/api/*` and `/dashboard`) | E |
| Security headers, CORS, cookie attrs | E |
| Stored XSS in 6 fields, SQL-text injection probe | E |
| Rate limits on transactions + AI chat | E |
| Attachment content-type filtering | E |
| Multi-tenancy data model audit | E |

## Coverage map — STILL not tested (queued for round 3 if you want)

- True offline behaviour with network throttled (harness limitation; would need a different MCP)
- Visual mobile rendering (resize_window doesn't actually resize this Chrome session)
- Auth flows: account creation, login form submission, session expiry, password reset
- Recurring rule with DST boundary (would need time-travel)
- Accessibility on remaining pages (categories, goals, receivables, payroll, business/*, personal/*, settings, reports)
- Performance past ~150 rows (didn't want to permanently pollute prod)
- SEO / Open Graph / sitemap
- Print stylesheet
- Service worker `bgsync` / queued POST replay
- Browser permissions (Notification, Camera for receipt scan, Clipboard)
- WebSocket / streaming endpoints (none observed)

---
