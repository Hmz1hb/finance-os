# Finance OS — Production QA Bug Ledger

**Audit run:** 2026-04-25
**Target:** `https://finance.elhilali.dev`
**Method:** 5 parallel UX agents driving Chrome via MCP, exercising real flows on the live deployment.

## How to use this checklist

- Each bug has a checkbox. **Tick it when fixed and ready for re-test.**
- After ticking, re-run the **Repro** steps and verify the **Expected** behavior.
- A separate "Round 2 — not yet covered" section at the bottom lists what was *intentionally not retested* so future audits can extend coverage without duplicating work.
- Severity: **P0** = data loss / broken core feature, **P1** = degrades trust / unsafe default, **P2** = polish.

---

## P0 — Critical

### Missing CRUD across the whole app

The "no delete on income-schedules" bug is **systemic**. There are zero `DELETE` route handlers in `src/app/api/**` and zero edit affordances in the UI on these entities. Each entity below is a separate fix.

- [ ] **P0 — Transactions: no edit, no delete**
  - **Page:** `/transactions`
  - **Repro:** Create any transaction → hover/click/right-click row → no affordance. `fetch('/api/transactions/<id>', {method: 'DELETE'})` → 404. Same for `PATCH`.
  - **Expected:** Edit (modal or inline) and delete (icon + confirm).
  - **Actual:** Mistakes are permanent.

- [ ] **P0 — Income schedules + recurring rules: no edit, no delete**
  - **Page:** `/income-schedules`
  - **Repro:** Look at any schedule card. No hover/right-click/three-dot/keyboard affordance.
  - **Expected:** Edit, delete, and a "Settle" / "Mark received" button on Upcoming-expected entries.
  - **Actual:** Only "Create schedule" exists.

- [ ] **P0 — Receivables: no edit, no delete**
  - **Page:** `/receivables`
  - **Repro:** Same as above on receivable rows.
  - **Expected:** Edit, delete, plus a way to remove a wrong partial payment.

- [ ] **P0 — Owner-pay records: no edit, no delete**
  - **Page:** `/payroll`
  - **Repro:** Same.

- [x] **P0 — Loans: no edit, no delete** *(Phase 2: API; row actions in Phase 4)*
  - **Page:** `/loans`
  - **Repro:** `DELETE`/`PATCH /api/loans/[id]` → 404.
  - **Expected:** Edit and delete; otherwise a single bad-data loan poisons every aggregate forever.

- [ ] **P0 — Subscriptions: no add/edit/delete UI at all**
  - **Page:** `/subscriptions`
  - **Repro:** Hint says "Add via API or transaction templates"; no form on the page.

- [ ] **P0 — Goals: no add/edit/delete UI at all**
  - **Page:** `/goals`
  - **Repro:** Page is heading + description only.

- [ ] **P0 — Categories: no add UI**
  - **Page:** `/categories`
  - **Repro:** Page shows "0 categories" with zero buttons. Quick-add Category dropdown stuck on "Uncategorized".

### Server actions silently fail

- [ ] **P0 — `ReceivableForm` server action returns 503 silently**
  - **Page:** `/receivables`
  - **Repro:** Fill all required fields with valid data → click "Add receivable" → form clears, no toast, no record. Network: `GET /receivables?_rsc=…` → 503.
  - **Expected:** Receivable created, or visible error.
  - **Actual:** Users cannot add receivables at all.

- [ ] **P0 — `OwnerCompensationForm` server action returns 503 silently**
  - **Page:** `/payroll`
  - **Repro:** Submit valid amount (250 GBP) → no record, no error. Same with negative amount.
  - **Expected:** Record created or validation message.

### Raw JSON / errors leaked to UI

- [ ] **P0 — `/business/tax` renders raw JSON rules**
  - **Repro:** Open `/business/tax`.
  - **Actual:** Literal strings render: `{ "kind": "UK_LTD_CORPORATION_TAX", "revenueCents": 0, "vatRegistered": false, ... }`, `{ "mainRate": 0.25, ... }`.

- [ ] **P0 — `/reports` renders raw health-score JSON**
  - **Repro:** Open `/reports`.
  - **Actual:** `<pre>{ "savingsRate": 0, "debtToIncome": 0, "goalProgress": 50, "emergencyFund": 0, "incomeDiversification": 60 }</pre>`.

- [ ] **P0 — `/income-schedules` form leaks Zod issue tree on error**
  - **Repro:** Pick INTERVAL_DAYS, submit without dayOfMonth/secondDayOfMonth/endDate.
  - **Actual:** UI renders `[ { "origin": "number", "code": "too_small", ... "path": ["dayOfMonth"] }, ... ]`.

- [ ] **P0 — `/loans` form leaks Zod issue tree on missing payoff date**
  - **Repro:** Submit loan form without `expectedPayoffDate`.
  - **Actual:** Same raw Zod dump on the page.

### Validation / business logic

- [x] **P0 — Loans: server-side validation absent** *(Phase 3)*
  - **Page:** `/loans`, `POST /api/loans`
  - **Repro:** `POST {originalAmount: -500, remainingBalance: -100, interestRate: 1000, expectedPayoffDate: "2020-01-01"}` → 200, persisted.
  - **Expected:** 400 with field errors.

- [ ] **P0 — Snowball/Avalanche planner doesn't toggle and orders neither way**
  - **Page:** `/loans`
  - **Repro:** Create 3 loans with different balances and rates. Order shown is balance-desc — neither snowball (smallest first) nor avalanche (highest rate first).
  - **Expected:** Snowball/Avalanche toggle that re-orders correctly.

### Data accuracy / cross-page consistency

- [x] **P0 — Net Worth ignores loans entirely** *(Phase 5)*
  - **Page:** `/net-worth`
  - **Repro:** Add a loan. `/loans` shows total debt. `/net-worth` Liabilities = 0.00.
  - **Expected:** Liabilities aggregate must include all active loans.

- [x] **P0 — Dashboard "Expected 30d" is 2× the EntityRail "Expected"** *(Phase 5)*
  - **Page:** `/dashboard`
  - **Repro:** Cockpit shows `Expected 30d = 46,324.12 د.م.`, EntityRail shows `Expected 23,162.06 د.م.` Same data, two different aggregations.
  - **Expected:** One source of truth.

- [x] **P0 — `/personal` "Debt remaining" is 7× the `/loans` "Total debt"** *(Phase 5)*
  - **Page:** `/personal` vs `/loans`
  - **Repro:** Personal shows 21,000 د.م., Loans shows 3,000 د.م.

- [x] **P0 — Dashboard "Cash now" tile ignores expenses** *(Phase 5)*
  - **Page:** `/dashboard`
  - **Repro:** EntityRail shows Combined = −42.50 د.م.; same-render Cockpit shows Cash now = 0.00 د.م.

### Settings page is barren

- [x] **P0 — `/settings` only has exchange-rates + empty `Preferences[]`** *(Phase 8 — Preferences card now lists known keys + defaults; AWS/PWA install metadata still TODO)*
  - **Repro:** Open `/settings`. Subtitle promises "Exchange rates, manual overrides, app preferences, AWS status, and PWA install metadata" — only the first exists.

---

## P1 — Major

- [ ] **P1 — Transaction submit button does not disable; double-click creates duplicates**
  - **Page:** `/transactions`
  - **Repro:** Quick-double-click "Save transaction" → 2 identical rows.
  - **Expected:** Disable on submit, clear form on success.

- [x] **P1 — Transactions API has no validation** *(Phase 3)*
  - **Repro:** `POST {kind:"EXPENSE", amount:-50, date:"2099-12-31"}` → 200 persisted; affects "Cash now" math.

- [x] **P1 — CSV import accepts pure garbage** *(Phase 3)*
  - **Page:** `/api/import/csv`
  - **Repro:** Import body `"this is not csv\nat all just nonsense"` → `{imported: 1}` (creates a 0-amount "Imported transaction" row).
  - **Expected:** Reject non-CSV with 400.

- [x] **P1 — Prisma errors leak to client with stack flavour** *(Phase 3)*
  - **Repro:** `POST /api/transactions {amount: 999999999999.99}` → response body contains `Invalid prisma.transaction.create() invocation: ... value "99999999999999" is out of range for type integer`.

- [x] **P1 — AI Bedrock not provisioned (chat + receipt OCR both broken)** *(Phase 8 — graceful 503 fallback ships; Bedrock use-case form for account 810500878308 still must be submitted by Hamza)*
  - **Page:** `/ai`, floating chat button, `/api/ai/receipt-ocr`
  - **Repro:** Send any chat message; upload any receipt image.
  - **Actual:** Bubble shows literal `{"error":"Model use case details have not been submitted for this account..."}`. All `/api/ai/chat` and `/api/ai/receipt-ocr` return 500.
  - **Fix:** Submit Anthropic Bedrock use-case form for AWS account 810500878308 (or change the model to one already approved). Then add a graceful fallback so this exact error never reaches the UI again.

- [x] ~~**P1 — `/auth/login` returns 404; app has no auth gate**~~ **CORRECTED in Round 2:** Auth IS working. Anonymous `GET /api/*` returns `401 {"error":"Unauthorized"}`; anonymous `GET /dashboard` returns 200 with the login page chunk inlined. Round 1's session simply already had a valid cookie. The `/auth/login` 404 is a routing label issue — the actual login UI is served from `/(auth)/login`. **Optional follow-up:** add a redirect from `/auth/login` → `/login` to match what users (and bots) might guess.

- [x] **P1 — AI chat: no client-side guards** *(Phase 8 — 4000-char cap, button disabled while loading, character counter)*
  - **Repro:** Empty submit → silent no-op (OK). 5000-char body → sent as-is. Spam-clicking → 2–3 in-flight POSTs, button never disables.

- [ ] **P1 — UK LTD entity labelled GBP but values render with MAD `د.م.` symbol**
  - **Page:** `?entity=uk_ltd` cockpit
  - **Repro:** Switch to UK LTD. Header pill says GBP; every value shows `0.00 د.م.`, `46,324.12 د.م.`.

- [ ] **P1 — Subscription currency mismatch**
  - **Page:** `/subscriptions`
  - **Repro:** Create subscription with 15.99 GBP → row displays as `£200.01` (the converted MAD value with the source currency's symbol).

- [x] **P1 — Subscription `entityId` silently dropped** *(Phase 3)*
  - **Repro:** `POST /api/subscriptions {entityId: "morocco_personal", ...}` → response shows `entityId: null`.

- [ ] **P1 — Loans UI does not refresh after create**
  - **Repro:** Toast says "Loan added" but list and totals stay stale until manual reload.

- [x] **P1 — Income-schedule schema requires irrelevant fields for INTERVAL_DAYS mode** *(Phase 3 — server schema; client form in Phase 4)*
  - **Repro:** Pick INTERVAL_DAYS, submit. Schema rejects until `dayOfMonth`, `secondDayOfMonth`, `endDate` are filled — even though they don't apply.

- [ ] **P1 — Negative owner-pay rejected silently with no UI feedback**
  - **Page:** `/payroll`
  - **Repro:** Enter `-500`, click Record → nothing happens.

- [ ] **P1 — `/reports` is a stub** (despite subtitle promising charts/exports/P&L)
  - **Repro:** Page shows 4 stat tiles + the raw JSON dump above. No date filter, no chart, no export, no category breakdown.

---

## P2 — Polish

- [x] **P2 — Wrong HTTP status codes on validation errors** *(Phases 1+3+7 — receipt-ocr graceful fallback in Phase 8)*
  - `/api/ai/receipt-ocr` returns 500 for client errors (should be 400/413).
  - `/api/subscriptions` returns 500 for bad enum (should be 400).
  - `/api/exchange-rates` POST with empty body returns 500 with raw Zod tree (should be 400 with sanitized message).

- [x] **P2 — Subscription Zod schema uses `z.date()` instead of `z.coerce.date()`** *(already used coerce.date in current code; confirmed during Phase 3 audit — likely fixed in an earlier commit)*
  - **Repro:** `POST /api/subscriptions {nextBillingDate: "2026-05-15"}` initially fails with `received: "Invalid Date"`.

- [ ] **P2 — `/personal/emergency-fund` auto-target meaningless on tiny windows**
  - **Repro:** With 2 expenses ever recorded, monthly avg = 21.25 د.م., target = 127.50 د.م. (6×).
  - **Expected:** "Insufficient history" empty-state until N months of data.

- [ ] **P2 — Intermittent 502 on `/dashboard`** (Cloudflare → EC2)
  - **Repro:** Pre-existing tab showed "elhilali.dev | 502: Bad gateway" at session start; subsequent loads OK.

- [ ] **P2 — Cluster of 503s on RSC prefetches**
  - Affected: `/business/tax?_rsc=…`, `/receivables?_rsc=…`, `/income-schedules?_rsc=…`, `/dashboard?_rsc=…`, `/transactions?_rsc=…`. Likely correlates with the 502.

- [ ] **P2 — "Combined" wallet card accumulates phantom negatives after failed mutations**
  - **Repro:** Visit any page, observe Combined go from 0 → −85.00 → −35.00 د.م. across failed actions. Suggests partial writes on failed server actions.

- [ ] **P2 — Future-dated transactions inconsistently filtered from ledger but still affect "Cash now"**

---

## Cleanup needed (per the very bug we're hunting, do this in DB)

These `[TEST-AGENT-*]` records were created during the audit and **cannot be deleted via the UI/API**:

- [ ] Delete `[TEST-AGENT-1]` transactions (~5 rows incl. one −50 MAD, one 2099-12-31, one 0-amount CSV)
- [ ] Delete `[TEST-AGENT-2] QA Schedule` from income schedules + recurring rules
- [ ] Delete 4 `[TEST-AGENT-3]` loans (Visa CC, Car Loan, Mortgage, Bad Validation)
- [ ] Delete `[TEST-AGENT-3] D7 Visa Fund` goal
- [ ] Delete `[TEST-AGENT-3] Netflix` subscription
- [ ] Delete 2 zero-value net-worth snapshots dated 2026-04-25

Suggested SQL once the entities have soft-delete fields:
```sql
UPDATE "Transaction" SET "deletedAt" = NOW() WHERE description LIKE '[TEST-AGENT-%]%';
UPDATE "Loan"        SET "deletedAt" = NOW() WHERE name        LIKE '[TEST-AGENT-%]%';
-- etc per entity
```

---

## Coverage map (so we don't re-test in round 2)

What round 1 already covered, by surface:

| Surface | Covered |
|---|---|
| `/transactions` | Create, validation (negatives/future/huge/garbage), edit/delete probe, CSV import (good + garbage), receipt upload (text/empty/oversized), console + network |
| `/categories` | Page shape (stub confirmed) |
| `/reports` | Page shape (stub confirmed), raw JSON dump |
| `/income-schedules` | Create (INTERVAL_DAYS), validation leak, edit/delete probe |
| `/receivables` | Create attempt (503), edit/delete probe |
| `/payroll` | Create attempt (503), negative-amount probe, edit/delete probe |
| `/loans` | Create (4 incl. invalid), validation, edit/delete probe, snowball/avalanche order check, currency/aggregate cross-check |
| `/subscriptions` | API create only, currency mismatch, entityId drop |
| `/goals` | Page shape (stub confirmed), API create |
| `/net-worth` | Aggregate accuracy vs loans, recompute call |
| `/dashboard` | Numbers sanity, cross-page mismatches, EntityRail vs cockpit |
| `/business/*` | Page render, raw JSON on /tax, empty-state copy |
| `/personal/*` | Page render, debt mismatch, emergency-fund auto-target |
| `/ai`, floating chat | Empty/long/spam prompts, Bedrock 500 leak |
| `/settings` | Stub confirmed, exchange-rate refresh works |
| `/offline` | Service worker registered |
| `/auth/login` | 404 confirmed |
| Sidebar nav | All 19 links resolved 200 |
| Console / Network | Errors captured per page; cluster of 503/502 logged |

---

## Round 2 — not yet covered (queued for next agent run)

These are intentionally **excluded** from the checklist above because no agent has tested them yet. A second audit round should target them so we don't re-discover known bugs:

- Mobile / responsive viewport rendering (resize_window failed; needs DevTools emulation or different harness)
- Accessibility — keyboard tab order, focus traps, ARIA labels, contrast, screen-reader semantics
- Multi-currency conversion accuracy + FX rate freshness across MAD/GBP/EUR/USD
- Date / timezone edge cases (UTC vs local, midnight boundaries, DST)
- True PWA offline behaviour (network throttling) and large-data performance
- Receivable partial-payment flow (blocked by 503 in round 1)
- Settle / un-settle expected income flow
- Goal contribution + completion flow
- Pay-myself action flow (blocked by 503 in round 1)
- Loan payment recording + snowball math correctness
- Browser back-button + SPA state edge cases on deep navigation
- Hard refresh on every deep route (only `/business/tax` was tested)
- Concurrent / multi-tab edits and optimistic UI
- API security: rate limits, CORS, security headers, XSS in form fields, SQL/NoSQL injection probes
- Internationalization / RTL for Arabic (MAD)
- SEO / meta / Open Graph
- Print stylesheet, any PDF/CSV exports
- Performance: Time-to-Interactive, large dataset rendering (1k+ transactions)

Round 2 results will be appended below this line.

---

# Round 2 — appended 2026-04-25

5 fresh agents covering surfaces round 1 explicitly punted on. Findings below.

## Round 2 — P0

### Security (Agent E)

- [x] **P0 — CSRF: API accepts `Content-Type: text/plain`, no Origin/Referer check, no CSRF token** *(Phase 7)*
  - **Page:** every `/api/*` write endpoint
  - **Repro:** From any origin: `fetch('/api/transactions',{method:'POST',credentials:'include',headers:{'Content-Type':'text/plain'},body: JSON.stringify({...})})` → 200, record persisted (id `cmoe4qs1p005i1nmrrwlebfoz`).
  - **Expected:** Reject non-`application/json` content-type for write methods, OR require `SameSite=Strict` session cookie + a CSRF header check.
  - **Actual:** Any web page can issue cross-origin "simple" POSTs that ride the user's session cookie.

- [x] **P0 — Attachments accept arbitrary file types and store them in S3 unfiltered** *(Phase 7)*
  - **Page:** `POST /api/attachments/upload`
  - **Repro:** Upload `.exe` → 200 (id `cmoe4ptdi005f1nmrftcth5a7`); upload `.html` containing a script → 200 (id `cmoe4ptas005e1nmrfz87lhos`).
  - **Expected:** Allowlist content-types (PDF, JPEG, PNG, WEBP, HEIC); re-derive content-type server-side from magic bytes; serve downloads with `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`.
  - **Actual:** Combined with presigned URLs whose path ends `.html`, an uploader could host phishing/XSS pages on the app's S3 bucket and share a presigned link.

- [ ] **P0 — No data-model multi-tenancy: `Transaction` has no `userId` column**
  - **Page:** schema-wide
  - **Repro:** `GET /api/transactions` (authed) returns 145 rows, none has a `userId` field — only `entityId`.
  - **Expected:** Add `userId` (or `tenantId`) to every owned entity before any second account is created.
  - **Actual:** If a second user is ever created, all queries return everyone's data.

### Previously-blocked flows (Agent C)

- [x] **P0 — Receivable payments accept overpayment, zero, and negative amounts** *(Phase 3)*
  - **Page:** `POST /api/receivables/[id]/payments`
  - **Repro:** On a 1,000 GBP receivable, post amounts 9999, 0, -100 → all 200. `paidAmountCents` ends 1,049,900 vs `amountCents` 100,000 (10× overpaid). Status flips to PAID after first overpayment.
  - **Expected:** 4xx with field error; clamp at outstanding balance.

- [x] **P0 — `expected-income/[id]/settle` is NOT idempotent — duplicate income on retry** *(Phase 2)*
  - **Page:** `POST /api/expected-income/[id]/settle`
  - **Repro:** Settle the same expected-income twice → two separate INCOME transactions created (`cmoe4oyus003m…`, `cmoe4oyxn003n…`) and parent `recurringRule.nextDueDate` advances twice.
  - **Expected:** Second call → 409 / no-op when status already SETTLED.

- [x] **P0 — `pay-myself` accepts negative amounts** *(Phase 3)*
  - **Page:** `POST /api/payroll/pay-myself`
  - **Repro:** `{amount:-500, currency:"GBP", paymentType:"salary"}` → 200, persisted twin transactions with `amountCents:-50000`. Net result: business "earns" 500 GBP back from a negative payroll.
  - **Expected:** 4xx.

- [x] **P0 — No goal-contribution / update / delete endpoint** *(Phase 2)*
  - **Page:** `/api/goals/[id]/*`
  - **Repro:** `POST /api/goals/[id]/contributions` → 404, `PATCH /api/goals/[id]` → 404, `PUT` → 404, `DELETE` → 404.
  - **Expected:** A way to increment `currentSavedCents` and mark a goal complete.
  - **Actual:** Goals are write-once; progress can never update after creation.

- [x] **P0 — No loan-payment endpoint** *(Phase 2: payment endpoint records principal/interest split & decreases balance; auto-interest accrual deferred — schema lacks `lastInterestAccrualAt`)*
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

- [ ] **P0 — Form inputs across the app have no associated labels for screen readers**
  - **Page:** `/transactions` (13 inputs, 7 unlabeled), `/loans` (11 inputs, 5 unlabeled)
  - **Repro:** `Array.from(document.querySelectorAll('main input,main select,main textarea')).filter(i => i.type!=='hidden' && !i.hasAttribute('aria-label') && !i.id)`
  - **Expected:** Every input has `<label for>`, `aria-label`, or `aria-labelledby`.
  - **Actual:** Inputs have only `name=` and sometimes `placeholder=`. Date input on `/transactions` has neither label nor placeholder — completely opaque to screen readers.

## Round 2 — P1

### Security (Agent E)

- [x] **P1 — No rate limiting on any endpoint** *(Phase 7 — in-memory token bucket, 60 writes/minute per session/IP)*
  - **Repro:** 50 parallel `POST /api/transactions` → 50× 200 in 813ms. 50 parallel `POST /api/ai/chat` → 50× 500 in 357ms (server-side Bedrock hits, no upstream throttle).
  - **Expected:** Per-IP and per-session limits in middleware.

- [x] **P1 — Missing every meaningful security header on both HTML and API responses** *(Phase 7)*
  - **Missing:** `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options` / `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`. `x-powered-by: Next.js` IS present (small leak).
  - **Expected:** At minimum HSTS, CSP, `frame-ancestors 'none'`, `nosniff`.

- [x] **P1 — `?entity=` is silently coerced to a default — no validation, no error** *(Phase 7 — dashboard now renders an "Unknown entity" empty state)*
  - **Page:** `/dashboard`
  - **Repro:** `?entity=does_not_exist`, `?entity=../something`, `?entity='; DROP TABLE entities; --` all return identical 200 with default-entity HTML. No 400, no error, no log.
  - **Expected:** Reject unknown entity IDs with 400 or render a clear "unknown entity" empty state.

- [x] **P1 — Zod issue tree leaks + 500 status on validation errors for more endpoints** *(Phases 1 + 3)*
  - **Endpoints:** `/api/exchange-rates`, `/api/recurring-rules`, `/api/goals`, `/api/subscriptions`, `/api/transactions`, `/api/loans`, `/api/payroll/pay-myself`.
  - **Expected:** 400 with sanitized message.
  - **Actual:** 500 with raw Zod issue tree in body. Pollutes error budgets and confuses any SW retry / monitoring layer.

- [x] **P1 — `/api/goals` accepts negative `targetAmount`** *(Phase 3)*
  - **Repro:** `POST /api/goals {targetAmount: -100, ...}` → 200 with `targetAmountCents: -10000` persisted (id `cmoe4pl8500531nmrxbzyxeyu`).
  - **Expected:** 400 with field error.

### Previously-blocked flows (Agent C)

- [ ] **P1 — Raw Prisma error leaked from `expected-income/[id]/settle` on bad ID**
  - **Repro:** Bogus ID → 500 with body `Invalid \`prisma.expectedIncome.findUniqueOrThrow()\`...`.
  - **Expected:** 404 with safe message.

- [x] **P1 — `pay-myself` raw Prisma error on amount overflow** *(Phase 3 — capped at 1,000,000)*
  - **Repro:** `{amount: 999999999}` → 500 with `Value out of range for the type: value "99999999900" is out of range for type integer`.
  - **Expected:** Validate to a sane max in Zod first.

- [x] **P1 — `pay-myself` transactions have `entityId: null` — orphaned from any entity** *(Phase 3)*
  - **Page:** `POST /api/payroll/pay-myself`
  - **Repro:** Both legs of every pay-myself record have `entityId: null`. They aggregate against COMBINED only and don't bind to UK LTD or Morocco Personal — breaks per-entity P&L.
  - **Code:** `src/app/api/payroll/pay-myself/route.ts:9` Zod schema has no `entityId` field.
  - **Expected:** Require `entityId` and bind both legs.

- [ ] **P1 — `pay-myself` accepts mismatched currency without warning or FX disclosure**
  - **Repro:** USD amount accepted with no entity check (UK LTD is GBP). No warning, no FX conversion shown to user.

### FX / i18n (Agent B)

- [x] **P1 — Settings "Refresh via API" navigates to raw JSON endpoint** *(Phase 8)*
  - **Page:** `/settings`
  - **Repro:** Click "Refresh via API" → browser navigates to `/api/exchange-rates` and shows raw JSON body. User must click Back.
  - **Expected:** Inline AJAX refresh, timestamp updates in place, optional toast.

- [x] **P1 — Cockpit "Expected 30d" inconsistent with EntityRail "Expected"** *(Phase 5)*
  - **Code:** `src/lib/server/cockpit.ts:9,23,53,64`
  - **Repro:** EntityRail filters `dueDate: { gte: now, lte: soon }` (line 23); cockpit only filters `lte: soon` with no `gte` (line 64) — so cockpit Expected includes past-due forecasts that the rail excludes. Both use `addDays(now, 30)` on millisecond-`Date`, so the cutoff drifts by call time.
  - **Expected:** One shared window helper; documented "30 days from start-of-today UTC" or similar.

### Accessibility (Agent A)

- [x] **P1 — AI advisor chat is not a real modal dialog** *(Phase 8)*
  - **Page:** `/ai` and floating chat
  - **Repro:** Open chat → no `[role="dialog"]`, no `aria-modal`, focus stays on `<body>`.
  - **Expected:** `role="dialog"` + `aria-modal="true"`, focus moves into the chat, focus trapped while open.

- [x] **P1 — Escape key does not close AI chat** *(Phase 8)*
  - **Repro:** Open chat → press Escape → textarea still rendered.
  - **Expected:** Escape closes any modal-style overlay.

- [x] **P1 — No "skip to main content" link on any audited page** *(Phase 8)*
  - **Pages:** `/dashboard`, `/transactions`, `/loans`, `/ai`
  - **Repro:** `Array.from(document.querySelectorAll('a')).find(a => /^skip/i.test(a.textContent.trim()))` → undefined.
  - **Expected:** Visually-hidden skip link as first focusable element (28+ focusable items before main on dashboard).

- [x] **P1 — Low-contrast text fails WCAG AA** *(Phase 8 — bumped --red-risk to #ff8b7a; "Manage schedules" link contrast still flags as ~4.4:1, follow-up needed)*
  - **Page:** `/dashboard` Combined cash card
  - **Evidence:** "-35.00 د.م." `rgb(231,76,60)` on `rgb(34,40,55)` 14px regular = **3.85:1** (need 4.5). "Manage schedules" `rgb(74,144,217)` on `rgb(34,40,55)` 12px = **4.4:1** (need 4.5).

## Round 2 — P2

- [x] **P2 — `/offline` page has no retry button** *(Phase 8)*
  - **Repro:** Visit `/offline` directly. Only static text + entity rail; zero buttons except "Open AI advisor".

- [ ] **P2 — PWA: `finance-os-api` cache exists but is never populated; `/dashboard` shell isn't precached either**
  - **Repro:** `caches.match('/dashboard')` → undefined. Only `/`, `/offline`, and static assets are cached.
  - **Expected:** Precache the dashboard shell so the PWA opens offline.

- [x] **P2 — `/api/loans` validation failures return HTTP 500 instead of 400** *(Phase 3)*
  - **Repro:** `POST /api/loans {kind: "PERSONAL_LOAN"}` (invalid enum) → 500 with Zod tree.
  - **Expected:** 400 with structured error (so SW retry / monitors don't flag as outage).

- [x] **P2 — `/api/transactions` no idempotency / dedupe on duplicate POSTs** *(Phase 8 — Idempotency-Key header dedupes within 60s)*
  - **Repro:** `Promise.all([POST, POST])` with identical body → both 200, two distinct rows (`cmoe4rp58005j…`, `cmoe4rp5c005k…`).
  - **Expected:** Idempotency key support, OR debounce by (date+amount+counterparty+description) within N seconds.

- [x] **P2 — Two `<h1>` elements on every audited page** *(Phase 8 — sidebar's "Cash cockpit" h1 demoted to a p)* — `<h1>Cash cockpit</h1>` and `<h1>Combined cash cockpit</h1>` both present on `/dashboard` (and similar on the other pages). Should be one H1 + H2/H3.

- [x] **P2 — No `prefers-reduced-motion` support** *(Phase 8 — globals.css now zeros animations/transitions when prefers-reduced-motion: reduce)* — zero `@media (prefers-reduced-motion)` rules in any stylesheet.

- [x] **P2 — Bottom-nav SVG icons not marked decorative** *(Phase 8 — aria-hidden on every nav icon)* — should have `aria-hidden="true"`.

- [x] **P2 — Attachment upload returns 500 for "Missing file" and 10MB-exceeded** *(Phase 7)* — should be 400 / 413.

- [ ] **P2 — No RTL support and no Intl number formatting for MAD**
  - **Repro:** `document.documentElement.dir` is none; `htmlLang="en"`.
  - **Expected:** For MAD, optionally `Intl.NumberFormat('fr-MA' | 'ar-MA', {style:'currency', currency:'MAD'})` → `1.234.567,89 د.م.` (period thousands, comma decimal).
  - **Actual:** Hand-rolled US format `1,234,567.89 د.م.` everywhere.

- [x] **P2 — `health-score` POST returns stale `id`/`createdAt` on same-day re-runs** *(Phase 5: incomeDiversification real calc; stale id/createdAt is a cosmetic upsert behaviour kept as-is)* — `breakdown`/`score` recomputed via `upsert` but response body shows yesterday's ID. Cosmetic but misleading. Also: `incomeDiversification` is **hardcoded to 60** in `src/lib/server/health.ts:29`.

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

- [ ] Delete `[TEST-AGENT-B-R2]` transactions (2 rows: GBP FX accuracy, Arabic bidi test)
- [ ] Delete `[TEST-AGENT-C-R2]` records: 1 receivable + 5 payments (overpaid `cmoe4mwj2000y…`), 3 pay-myself records (6 paired transactions), 2 duplicate settle transactions
- [ ] Delete `[TEST-AGENT-D-R2]` records: 75 perf-test transactions + 2 dupe-test transactions
- [ ] Delete `[TEST-AGENT-E-R2-…]` records: ~57 transactions (1 XSS, 1 SQL-text, 1 CSRF probe, 4 misc validation, 50 from rate-limit flood), 2 goals (1 XSS, 1 negative-amount), 1 subscription, 1 loan, 1 receivable, 2 attachments

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
