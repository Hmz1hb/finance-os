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

- [x] **P0 — Transactions: no edit, no delete** *(Phases 2+4 — Delete via RowActions kebab; Edit dialog scaffolded but per-resource edit forms left as follow-up)*  ✓ Verified 2026-04-25 (RowActions kebab on every row; DELETE /api/transactions/[id] live → 401 unauth; PATCH live; Edit menu item still NOT exposed — consistent with the follow-up caveat)
  - **Page:** `/transactions`
  - **Repro:** Create any transaction → hover/click/right-click row → no affordance. `fetch('/api/transactions/<id>', {method: 'DELETE'})` → 404. Same for `PATCH`.
  - **Expected:** Edit (modal or inline) and delete (icon + confirm).
  - **Actual:** Mistakes are permanent.

- [x] **P0 — Income schedules + recurring rules: no edit, no delete** *(Phases 2+4 — RowActions on both lists; Settle button can be wired to existing settle endpoint as a follow-up)*  ✓ Verified 2026-04-25 (RowActions on expected-income rows AND recurring-rules rows; DELETE /api/recurring-rules/[id] live; no Settle button yet — consistent with caveat; Edit also not yet exposed via onEdit)
  - **Page:** `/income-schedules`
  - **Repro:** Look at any schedule card. No hover/right-click/three-dot/keyboard affordance.
  - **Expected:** Edit, delete, and a "Settle" / "Mark received" button on Upcoming-expected entries.
  - **Actual:** Only "Create schedule" exists.

- [x] **P0 — Receivables: no edit, no delete** *(Phases 2+4 — RowActions wired; deleting a partial payment is a follow-up)*  ✓ Verified 2026-04-25 (RowActions on each receivable row; DELETE /api/receivables/[id] live; partial-payment delete still absent per caveat; Edit affordance not yet exposed)
  - **Page:** `/receivables`
  - **Repro:** Same as above on receivable rows.
  - **Expected:** Edit, delete, plus a way to remove a wrong partial payment.

- [x] **P0 — Owner-pay records: no edit, no delete** *(Phases 2+4 — RowActions wired; DELETE cascades to paired transactions)*  ✓ Verified 2026-04-25 (DELETE /api/owner-pay/[id] soft-deletes paired business+personal transactions inside a $transaction; PATCH also keeps paired tx amounts in sync)
  - **Page:** `/payroll`
  - **Repro:** Same.

- [x] **P0 — Loans: no edit, no delete** *(Phase 2: API; row actions in Phase 4)*  ✓ Verified 2026-04-25 (DELETE/PATCH /api/loans/[id] live → 401 unauth; RowActions on loan rows; Edit affordance not yet wired via onEdit)
  - **Page:** `/loans`
  - **Repro:** `DELETE`/`PATCH /api/loans/[id]` → 404.
  - **Expected:** Edit and delete; otherwise a single bad-data loan poisons every aggregate forever.

- [x] **P0 — Subscriptions: no add/edit/delete UI at all** *(Phase 4 — SubscriptionForm + RowActions)*  ✓ Verified 2026-04-25 (SubscriptionForm rendered on the page wired to POST /api/subscriptions via useFormSubmit; RowActions on every row; DELETE /api/subscriptions/[id] live)
  - **Page:** `/subscriptions`
  - **Repro:** Hint says "Add via API or transaction templates"; no form on the page.

- [x] **P0 — Goals: no add/edit/delete UI at all** *(Phase 4 — GoalForm + GoalContributeForm + RowActions)*  ✓ Verified 2026-04-25 (GoalForm + GoalContributeForm both rendered; RowActions on each goal; DELETE /api/goals/[id] + POST /api/goals/[id]/contributions both live)
  - **Page:** `/goals`
  - **Repro:** Page is heading + description only.

- [x] **P0 — Categories: no add UI** *(Phase 4 — CategoryForm + RowActions hidden on system rows)*  ✓ Verified 2026-04-25 (CategoryForm renders + POST /api/categories hard-codes isSystem:false; page renders RowActions only when !isSystem; PATCH/DELETE /api/categories/[id] also reject system rows with HTTP 403)
  - **Page:** `/categories`
  - **Repro:** Page shows "0 categories" with zero buttons. Quick-add Category dropdown stuck on "Uncategorized".

### Server actions silently fail

- [x] **P0 — `ReceivableForm` server action returns 503 silently** *(Phase 4 — refactored to useFormSubmit; errors now surface as toasts; the underlying API was already healthy after Phase 3)*  ✓ Verified 2026-04-25 (POST /api/receivables anon → 401, not 503; form posts JSON via useFormSubmit and toasts errors)
  - **Page:** `/receivables`
  - **Repro:** Fill all required fields with valid data → click "Add receivable" → form clears, no toast, no record. Network: `GET /receivables?_rsc=…` → 503.
  - **Expected:** Receivable created, or visible error.
  - **Actual:** Users cannot add receivables at all.

- [x] **P0 — `OwnerCompensationForm` server action returns 503 silently** *(Phase 4 — refactored to useFormSubmit; Phase 3 server validation surfaces negative-amount rejection as a toast)*  ✓ Verified 2026-04-25 (POST /api/owner-pay anon → 401, not 503; form uses useFormSubmit; negative amount rejected at the schema)
  - **Page:** `/payroll`
  - **Repro:** Submit valid amount (250 GBP) → no record, no error. Same with negative amount.
  - **Expected:** Record created or validation message.

### Raw JSON / errors leaked to UI

- [x] **P0 — `/business/tax` renders raw JSON rules** *(Phase 4 — TaxRulesPanel)*  ✓ Verified 2026-04-25
  - **Repro:** Open `/business/tax`.
  - **Actual:** Literal strings render: `{ "kind": "UK_LTD_CORPORATION_TAX", "revenueCents": 0, "vatRegistered": false, ... }`, `{ "mainRate": 0.25, ... }`.

- [x] **P0 — `/reports` renders raw health-score JSON** *(Phase 4 — 5-stat MetricCard grid; charts/exports/P&L still pending)*  ✓ Verified 2026-04-25
  - **Repro:** Open `/reports`.
  - **Actual:** `<pre>{ "savingsRate": 0, "debtToIncome": 0, "goalProgress": 50, "emergencyFund": 0, "incomeDiversification": 60 }</pre>`.

- [x] **P0 — `/income-schedules` form leaks Zod issue tree on error** *(Phases 1+3+4 — server returns 400 with sanitized issues, client toasts them; INTERVAL_DAYS hides the irrelevant inputs)*  ✓ Verified 2026-04-25
  - **Repro:** Pick INTERVAL_DAYS, submit without dayOfMonth/secondDayOfMonth/endDate.
  - **Actual:** UI renders `[ { "origin": "number", "code": "too_small", ... "path": ["dayOfMonth"] }, ... ]`.

- [x] **P0 — `/loans` form leaks Zod issue tree on missing payoff date** *(Phases 1+3+4 — sanitized issues via toast)*  ✓ Verified 2026-04-25
  - **Repro:** Submit loan form without `expectedPayoffDate`.
  - **Actual:** Same raw Zod dump on the page.

### Validation / business logic

- [x] **P0 — Loans: server-side validation absent** *(Phase 3)*  ✓ Verified 2026-04-25
  - **Page:** `/loans`, `POST /api/loans`
  - **Repro:** `POST {kind:"OWED_BY_ME", lenderName:"X", originalAmount:-500, currency:"MAD", interestRate:1000, monthlyPayment:50, startDate:"2026-01-01", expectedPayoffDate:"2020-01-01", remainingBalance:-100}` → 200, persisted. *(R10 2026-04-26: example payload normalized against the current schema — `kind`/`lenderName`/`monthlyPayment`/`startDate` are required; the negative + out-of-range fields are still the parts the server should reject.)*
  - **Expected:** 400 with field errors.

- [x] **P0 — Snowball/Avalanche planner doesn't toggle and orders neither way** *(Phase 6 — ?strategy=snowball|avalanche with LoanStrategyToggle pills)*
  - **Page:** `/loans`
  - **Repro:** Create 3 loans with different balances and rates. Order shown is balance-desc — neither snowball (smallest first) nor avalanche (highest rate first).
  - **Expected:** Snowball/Avalanche toggle that re-orders correctly.

### Data accuracy / cross-page consistency

- [x] **P0 — Net Worth ignores loans entirely** *(Phase 5)*  ✓ Verified 2026-04-25 (created [TEST-AGENT-R3-V3] 100 GBP loan → /net-worth Liabilities went 0 → 100; Net worth -100)
  - **Page:** `/net-worth`
  - **Repro:** Add a loan. `/loans` shows total debt. `/net-worth` Liabilities = 0.00.
  - **Expected:** Liabilities aggregate must include all active loans.

- [x] **P0 — Dashboard "Expected 30d" is 2× the EntityRail "Expected"** *(Phase 5)*  ✓ Verified 2026-04-25 (Cockpit "Expected 30d" 23.162,06 = EntityRail "Expected" 23.162,06; one source of truth)
  - **Page:** `/dashboard`
  - **Repro:** Cockpit shows `Expected 30d = 46,324.12 د.م.`, EntityRail shows `Expected 23,162.06 د.م.` Same data, two different aggregations.
  - **Expected:** One source of truth.

- [x] **P0 — `/personal` "Debt remaining" is 7× the `/loans` "Total debt"** *(Phase 5)*  ✓ Verified 2026-04-25 (with [TEST-AGENT-R3-V3] loan: /loans Total debt = /personal Debt remaining = 100,00 د.م.; consistent)
  - **Page:** `/personal` vs `/loans`
  - **Repro:** Personal shows 21,000 د.م., Loans shows 3,000 د.م.

- [x] **P0 — Dashboard "Cash now" tile ignores expenses** *(Phase 5)*  ✓ Verified 2026-04-25 (after posting [TEST-AGENT-R3-V3] 50 GBP expense, EntityRail Combined dropped 130.075,04 → 129.449,62 = exactly 625,42 د.م. = 50 GBP × 12.508418; Cockpit Cash now also dropped — both surfaces respect expenses now)
  - **Page:** `/dashboard`
  - **Repro:** EntityRail shows Combined = −42.50 د.م.; same-render Cockpit shows Cash now = 0.00 د.م.

### Settings page is barren

- [x] **P0 — `/settings` only has exchange-rates + empty `Preferences[]`** *(Phase 8 — Preferences card now lists known keys + defaults; AWS/PWA install metadata still TODO)*
  - **Repro:** Open `/settings`. Subtitle promises "Exchange rates, manual overrides, app preferences, AWS status, and PWA install metadata" — only the first exists.

---

## P1 — Major

- [x] **P1 — Transaction submit button does not disable; double-click creates duplicates** *(Phase 4 — useFormSubmit disables button while submitting; Phase 8 also adds Idempotency-Key as a server-side dedupe)*  ✓ Verified 2026-04-25 — realistic ~100ms double-click yields 1 fetch / 1 row; button.disabled flips between native click events. Caveat: synchronous `btn.click(); btn.click()` (no event-loop yield) still fires twice — and the form does NOT attach an Idempotency-Key header to its POST. Belt-and-braces fix would be to add the Idempotency-Key on the form, since the server already supports it.
  - **Page:** `/transactions`
  - **Repro:** Quick-double-click "Save transaction" → 2 identical rows.
  - **Expected:** Disable on submit, clear form on success.

- [x] **P1 — Transactions API has no validation** *(Phase 3)*  ✓ Verified 2026-04-25
  - **Repro:** `POST {kind:"EXPENSE", amount:-50, date:"2099-12-31"}` → 200 persisted; affects "Cash now" math.

- [x] **P1 — CSV import accepts pure garbage** *(Phase 3)*  ✓ Verified 2026-04-25 (multipart upload of garbage → 400 "missing required columns: amount, date")
  - **Page:** `/api/import/csv`
  - **Repro:** Import body `"this is not csv\nat all just nonsense"` → `{imported: 1}` (creates a 0-amount "Imported transaction" row).
  - **Expected:** Reject non-CSV with 400.

- [x] **P1 — Prisma errors leak to client with stack flavour** *(Phase 3)*  ✓ Verified 2026-04-25 (amount: 999999999999.99 → 400 sanitized "Amount must be > 0 and within reasonable bounds")
  - **Repro:** `POST /api/transactions {amount: 999999999999.99}` → response body contains `Invalid prisma.transaction.create() invocation: ... value "99999999999999" is out of range for type integer`.

- [x] **P1 — AI Bedrock not provisioned (chat + receipt OCR both broken)** *(Phase 8 — graceful 503 fallback ships; Bedrock use-case form for account 810500878308 still must be submitted by Hamza)*
  - **Page:** `/ai`, floating chat button, `/api/ai/receipt-ocr`
  - **Repro:** Send any chat message; upload any receipt image.
  - **Actual:** Bubble shows literal `{"error":"Model use case details have not been submitted for this account..."}`. All `/api/ai/chat` and `/api/ai/receipt-ocr` return 500.
  - **Fix:** Submit Anthropic Bedrock use-case form for AWS account 810500878308 (or change the model to one already approved). Then add a graceful fallback so this exact error never reaches the UI again.

- [x] ~~**P1 — `/auth/login` returns 404; app has no auth gate**~~ **CORRECTED in Round 2:** Auth IS working. Anonymous `GET /api/*` returns `401 {"error":"Unauthorized"}`; anonymous `GET /dashboard` returns 200 with the login page chunk inlined. Round 1's session simply already had a valid cookie. The `/auth/login` 404 is a routing label issue — the actual login UI is served from `/(auth)/login`. **Optional follow-up:** add a redirect from `/auth/login` → `/login` to match what users (and bots) might guess.

- [x] **P1 — AI chat: no client-side guards** *(Phase 8 — 4000-char cap, button disabled while loading, character counter)*  ✓ Verified 2026-04-25 — textarea has `maxlength=4000`, `0/4000` counter renders, send button starts `disabled=true` until input.
  - **Repro:** Empty submit → silent no-op (OK). 5000-char body → sent as-is. Spam-clicking → 2–3 in-flight POSTs, button never disables.

- [x] **P1 — UK LTD entity labelled GBP but values render with MAD `د.م.` symbol**  ✓ R6-verified 2026-04-26 — live `?entity=uk_ltd` cockpit: `Cash now £3,273.58`, `Expected 30d £1,851.72`, 0 dirhams in cockpit body. Earlier R4 deploy-gap entry kept for history:  ✗ Confirmed still broken 2026-04-25 — `?entity=uk_ltd` dashboard shows pill "GBP" + a separate "GBP" label above the cockpit, but every value still renders with `د.م.` (e.g. Cash now `117.243,02 د.م.`, Expected 30d `23.162,06 د.م.`). UK LTD cockpit/rail aggregates are MAD-equivalent values with the wrong symbol — should either render in GBP or drop the GBP pill. *(Fix 2026-04-25 — cockpitSummary now converts MAD-equivalent cents back into the active entity's baseCurrency and exposes it as `displayCurrency`; dashboard renders headline tiles with formatMoney(cents, displayCurrency).)*
  - **Page:** `?entity=uk_ltd` cockpit
  - **Repro:** Switch to UK LTD. Header pill says GBP; every value shows `0.00 د.م.`, `46,324.12 د.م.`.

- [x] **P1 — Subscription currency mismatch** *(Phase 4 — now formatMoney(sub.amountCents, sub.currency) so source currency + amount match)*  ✓ Verified 2026-04-25 (created [TEST-AGENT-R3-V3] 15.99 GBP MONTHLY sub → row shows `£15.99` exactly; "Monthly burn" totals show in MAD as expected)
  - **Page:** `/subscriptions`
  - **Repro:** Create subscription with 15.99 GBP → row displays as `£200.01` (the converted MAD value with the source currency's symbol).

- [x] **P1 — Subscription `entityId` silently dropped** *(Phase 3)*  ✓ Verified 2026-04-25 (subscriptions schema now validates `context`, `billingCycle`, `category`; entityId no longer silently dropped — confirmed via 400 issue list)
  - **Repro:** `POST /api/subscriptions {entityId: "morocco_personal", ...}` → response shows `entityId: null`.

- [x] **P1 — Loans UI does not refresh after create** *(Phase 4 — useFormSubmit invokes router.refresh() on success)*  ✓ Verified 2026-04-25 — submitted `[TEST-AGENT-R3-V4-loan-form]` via the form; new row appears on the page without manual reload.
  - **Repro:** Toast says "Loan added" but list and totals stay stale until manual reload.

- [x] **P1 — Income-schedule schema requires irrelevant fields for INTERVAL_DAYS mode** *(Phase 3 — server schema; client form in Phase 4)*  ✓ Verified 2026-04-25
  - **Repro:** Pick INTERVAL_DAYS, submit. Schema rejects until `dayOfMonth`, `secondDayOfMonth`, `endDate` are filled — even though they don't apply.

- [x] **P1 — Negative owner-pay rejected silently with no UI feedback** *(Phases 3+4 — server returns 400 with sanitized issues; client toasts them)*  ✓ Verified 2026-04-25
  - **Page:** `/payroll`
  - **Repro:** Enter `-500`, click Record → nothing happens.

- [ ] **P1 — `/reports` is a stub** (despite subtitle promising charts/exports/P&L) *(Phase 4 removed the JSON dump and added a labelled-stat grid; charts / exports / P&L breakdown remain a feature follow-up — kept unchecked for the bigger feature build)*
  - **Repro:** Page shows 4 stat tiles + the raw JSON dump above. No date filter, no chart, no export, no category breakdown.

---

## P2 — Polish

- [x] **P2 — Wrong HTTP status codes on validation errors** *(Phases 1+3+7 — receipt-ocr graceful fallback in Phase 8)*  ✓ Verified 2026-04-25 (receipt-ocr empty form → 400, oversized → 413, AI down → 503; subs bad enum → 400; exchange-rates empty → 400)
  - `/api/ai/receipt-ocr` returns 500 for client errors (should be 400/413).
  - `/api/subscriptions` returns 500 for bad enum (should be 400).
  - `/api/exchange-rates` POST with empty body returns 500 with raw Zod tree (should be 400 with sanitized message).

- [x] **P2 — Subscription Zod schema uses `z.date()` instead of `z.coerce.date()`** *(already used coerce.date in current code; confirmed during Phase 3 audit — likely fixed in an earlier commit)*  ✓ Verified 2026-04-25 (string nextBillingDate now passes the date check; schema fails only on missing required enums)
  - **Repro:** `POST /api/subscriptions {nextBillingDate: "2026-05-15"}` initially fails with `received: "Invalid Date"`.

- [x] **P2 — `/personal/emergency-fund` auto-target meaningless on tiny windows** *(Fix 2026-04-25 — emergencyFundProjection() in src/lib/server/health.ts returns "insufficient_history" when fewer than 3 distinct months exist; page renders an empty state instead of multiplying noise by 6)*
  - **Repro:** With 2 expenses ever recorded, monthly avg = 21.25 د.م., target = 127.50 د.م. (6×).
  - **Expected:** "Insufficient history" empty-state until N months of data.

- [ ] **P2 — Intermittent 502 on `/dashboard`** (Cloudflare → EC2)
  - **Repro:** Pre-existing tab showed "elhilali.dev | 502: Bad gateway" at session start; subsequent loads OK.

- [ ] **P2 — Cluster of 503s on RSC prefetches**
  - Affected: `/business/tax?_rsc=…`, `/receivables?_rsc=…`, `/income-schedules?_rsc=…`, `/dashboard?_rsc=…`, `/transactions?_rsc=…`. Likely correlates with the 502.

- [x] **P2 — "Combined" wallet card accumulates phantom negatives after failed mutations** ✓ R10-fixed 2026-04-26 — root cause was `src/app/api/payroll/pay-myself/route.ts` using the `prisma.$transaction([...])` array form for steps 1–2 (balanced EXPENSE + INCOME) then bare `prisma.payrollPerson.upsert` and `prisma.payrollPayment.create` outside the transaction. Step-3/4 failures committed the balanced rows orphan-style and the wallet aggregation in `src/lib/server/cockpit.ts` picked them up. Converted to interactive `prisma.$transaction(async (tx) => …)` so all 4 steps participate in one atomic boundary; `tests/payroll-pay-myself-rollback.test.ts` asserts 0 leftover rows on forced step-3 failure. Cluster F also audited every other multi-step route and confirmed they already use the interactive form.
  - **Repro:** Visit any page, observe Combined go from 0 → −85.00 → −35.00 د.م. across failed actions. Suggests partial writes on failed server actions.

- [x] **P2 — Future-dated transactions inconsistently filtered from ledger but still affect "Cash now"** *(Fix 2026-04-25 — cockpit cashBalance now scopes the where clause to `date <= now`, and the /transactions ledger flags future-dated rows with a "Scheduled" badge.)*

---

## Cleanup needed (per the very bug we're hunting, do this in DB)

These `[TEST-AGENT-*]` records were created during the audit and **cannot be deleted via the UI/API**:

- [x] Delete `[TEST-AGENT-1]` transactions (~5 rows incl. one −50 MAD, one 2099-12-31, one 0-amount CSV) *(Phase 9 — bundled with R2 transactions: 138 total soft-deleted)*
- [x] Delete `[TEST-AGENT-2] QA Schedule` from income schedules + recurring rules *(Phase 9 — 1 RecurringRule soft-deleted, 1 ExpectedIncome CANCELLED)*
- [x] Delete 4 `[TEST-AGENT-3]` loans (Visa CC, Car Loan, Mortgage, Bad Validation) *(Phase 9 — 5 loans soft-deleted including R2)*
- [x] Delete `[TEST-AGENT-3] D7 Visa Fund` goal *(Phase 9 — 3 goals soft-deleted)*
- [x] Delete `[TEST-AGENT-3] Netflix` subscription *(Phase 9 — 2 subscriptions soft-deleted)*
- [x] Delete 2 zero-value net-worth snapshots dated 2026-04-25 *(Phase 9 — hard-deleted via DELETE; NetWorthSnapshot has no deletedAt column)*

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
