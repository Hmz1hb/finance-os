# Open bugs

Single source of truth for what's still broken. Sorted by severity. Each entry points to its round file for the full repro / context. Last refreshed after Round 10 (2026-04-26).

When a bug is fixed, tick it here AND in its origin round file, then move it to `## Closed in this batch` at the bottom (clear that section after each commit).

---

## P0

- [ ] **Multi-tenancy `userId` missing on every owned entity** — origin: [`02-extended-coverage.md`](rounds/02-extended-coverage.md). Deferred until a 2nd account is created. `Transaction` (and every sibling) has only `entityId`, no `userId` / `tenantId`. The day a second user signs up, every query returns everyone's data. Add the column + backfill + middleware filter before that day.

## P1

- [ ] **`/reports` is a stub** — origin: [`01-original-audit.md`](rounds/01-original-audit.md). Subtitle promises charts/exports/P&L; page renders 4 stat tiles + nothing else. Feature work, not a bug fix.

## P2

- [ ] **Intermittent 502 on `/dashboard`** — origin: [`01-original-audit.md`](rounds/01-original-audit.md). Cloudflare → EC2. Pre-existing tab showed 502 at session start; subsequent loads OK. Needs ops investigation, not a code fix.
- [ ] **Cluster of 503s on RSC prefetches** — origin: [`01-original-audit.md`](rounds/01-original-audit.md). Affects `/business/tax`, `/receivables`, `/income-schedules`, `/dashboard`, `/transactions` `?_rsc=…`. Likely correlates with the 502 above.
- [ ] **JWT session cannot be revoked; concurrent sessions are uncoordinated** — origin: [`03-crud-verification.md`](rounds/03-crud-verification.md). NextAuth JWT strategy, no DB session table. A leaked cookie remains valid for up to 30 days. Low blast radius today (single-user); becomes account-takeover risk if a 2nd user is added.
- [ ] **No virtualization on /transactions ledger** — origin: [`04-deploy-gap.md`](rounds/04-deploy-gap.md). Less urgent now that R7 added cursor pagination; bounded DOM per page. Worth flagging only if Hamza wants infinite-scroll with stable scroll restoration.

## P3

- [ ] **Generic offline error toast on transaction submit** — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). Hijacked-fetch repro shows toast "Could not save transaction." with no offline-aware copy, no retry affordance, no client-side queue (matches ground truth: no `BackgroundSync`). UX polish for a PWA.
- [ ] **Service-worker NetworkFirst on `/api/*` did not populate runtime cache** — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). Informational. Caches keys list `workbox-precache`, `finance-os-static-assets`, `start-url`; no `/api/*` runtime cache materialized after a successful `GET /api/transactions`. Either NetworkFirst handler is gated to a narrower path pattern, or page-initiated fetches bypass SW. Could be intentional cache scoping.
- [ ] **`<input type="date">` only — no time component on transactions** — origin: [`02-extended-coverage.md`](rounds/02-extended-coverage.md). Storage is ISO datetime; dates are implicitly midnight in some TZ. Off-by-one display risk for TZs west of UTC. Africa/Casablanca (UTC+1) doesn't repro. R7 already fixed display-side TZ slicing — this one is about **input** granularity.
- [ ] **Ledger has no virtualization** — origin: [`02-extended-coverage.md`](rounds/02-extended-coverage.md). Largely superseded by R7 cursor pagination; per-page DOM is bounded. Same status as the P2 above.
- [ ] **Presigned attachment URLs: 1-hour expiry, no IP/Origin restrictions** — origin: [`02-extended-coverage.md`](rounds/02-extended-coverage.md). Acceptable for receipts; worth noting for future hardening.
- [ ] **Notification API never triggered for due recurring rules / receivable aging / subscription renewals** — origin: [`03-crud-verification.md`](rounds/03-crud-verification.md). Product gap, not a regression. Service Worker is cache-only; no `Notification.requestPermission()` is wired.
- [ ] **`createReceivable` and `createRecurringRule` write `expectedIncome` outside `$transaction`** — origin: [`10-team-fix-batch.md`](rounds/10-team-fix-batch.md). Surfaced during Cluster F's audit. `src/lib/server/cashflows.ts:51–72` and `:157–189` create the parent row, then create the dependent `expectedIncome` outside any `$transaction`. Failure of the second write leaves an orphan parent. Same shape as the wallet-phantom bug R10 fixed in `pay-myself`, but the read-side impact is on the `/receivables` and `/expected-income` listings, not the wallet card. Same fix recipe as Cluster F (interactive `$transaction(async (tx) => …)`).
- [ ] **PATCH cross-field validation does not consult the DB** — origin: [`10-team-fix-batch.md`](rounds/10-team-fix-batch.md). R10's `loanDateRefinement` and `recurringRuleRefinement` `superRefine` helpers fire only when both fields are present in the request body. A client PATCHing only `expectedPayoffDate` to a value that contradicts the stored `startDate` is not caught. Closing the gap requires reading the row before validating, or adding a DB CHECK. Real risk on loans (date contradiction); much smaller risk on recurring-rules (cadence-day fields are usually patched together).
- [ ] **Goal-contribution and receivable overpayment guards are server-snapshot based (TOCTOU)** — origin: [`10-team-fix-batch.md`](rounds/10-team-fix-batch.md). R10's overpayment check on goals (mirroring receivables) reads then writes; two parallel POSTs can both pass. DB CHECK constraints (`currentSavedCents <= targetAmountCents`, `cumulativePaymentsCents <= totalAmountCents`) close the window. P3 hardening.
- [ ] **Loan schema repro example in Round 1 ledger is stale** — origin: [`03-crud-verification.md`](rounds/03-crud-verification.md). ✓ R10 patched `01-original-audit.md:95` to reflect the current required fields (`kind`, `lenderName`, `monthlyPayment`, `startDate`); this entry is closed but kept ticked for one round before clearing.

---

## Out-of-scope informational entries

These appear as `[ ]` in round files but were never bugs — they're coverage notes / verified-non-bugs / route maps. Don't fix; consider removing the leading `[ ]` next time we touch the round file:

- `03-crud-verification.md:240` — N1 Auth route map (informational)
- `03-crud-verification.md:246` — N1 Cookie attributes (verified clean)
- `03-crud-verification.md:252` — N1 Verified non-bugs (informational)
- `03-crud-verification.md:260` — N1 Coverage notes (informational)

---

## Closed in this batch

Closed in **R10** (2026-04-26 — 6-agent parallel fix batch). Clear this section in the next round's closing commit.

- [x] **PATCH validation parity drops `> 0` refinement on monetary fields (6 routes)** (P2) — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). ✓ R10-fixed: shared `src/lib/server/schemas.ts` imported by every POST + PATCH; closes R9-EDIT-001 plus the four P3 PATCH-parity items below.
- [x] **Goal contributions silently exceed target** (P2) — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). ✓ R10-fixed: explicit overpayment guard in `src/app/api/goals/[id]/contributions/route.ts`.
- [x] **"Combined" wallet card accumulates phantom negatives after failed mutations** (P2) — origin: [`01-original-audit.md`](rounds/01-original-audit.md). ✓ R10-fixed: `pay-myself` route converted to interactive `prisma.$transaction(async (tx) => …)` so step-3/4 failures roll back the balanced rows.
- [x] **`POST /api/ai/receipt-ocr` returns 415 for >10 MB body instead of documented 413** (P3) — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). ✓ R10-fixed: `Content-Length` pre-check on receipt-ocr + attachments/upload before `request.formData()`.
- [x] **React #418 hydration mismatch on `/transactions` cold load** (P3) — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). ✓ R10-fixed: `formatLocalYmd` extracted to `src/lib/finance/date.ts` pinned to Africa/Casablanca; `serverNowMs` threaded from page server component for the "Scheduled" badge cutoff.
- [x] **50+ sub-32px touch targets on `/transactions`** (P3) — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). ✓ R10-fixed for the row-actions button (`h-7 w-7` → `h-8 w-8 p-1.5`). The "13×13 select-all checkbox" sub-claim was a Round 9 false positive — no select-all UI exists in the ledger; recorded in the R10 round file as a verified non-bug.
- [x] **Loans `interestRate` cap missing on PATCH** (P3) — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). ✓ R10-fixed via shared `interestRate` primitive imported by both POST and PATCH.
- [x] **Loans payoff cross-check missing on PATCH** (P3) — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). ✓ R10-fixed via shared `loanDateRefinement` superRefine (when both fields are present in the patch).
- [x] **Goals `currentSaved >= 0` missing on PATCH** (P3) — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). ✓ R10-fixed via shared `nonNegativeAmountOptional` primitive.
- [x] **Recurring-rules `superRefine` missing on PATCH** (P3) — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). ✓ R10-fixed via shared `recurringRuleRefinement` superRefine wired into both POST and PATCH.
- [x] **`0.004 GBP` accepted with `amountCents: 0`** (P3) — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). ✓ R10-fixed: `positiveAmount` primitive runs `toCents()` inside its refine and asserts `cents >= 1`.
- [x] **Focus-trap in the Delete-confirm dialog: not provable via automation** (P3) — origin: [`03-crud-verification.md`](rounds/03-crud-verification.md). ✓ R10-closed by code read of `src/components/app/confirm-dialog.tsx:28–63` — custom Tab-wrap with `previousActive?.focus()` restore on top of Radix `Dialog`.
- [x] **`/sw.js` served with `cache-control: public, max-age=14400`** (P3 informational) — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). ✓ R10-fixed: `next.config.ts` adds a `/sw.js` headers entry returning `Cache-Control: no-cache, no-store, must-revalidate`.
- [x] **R8 polish — Prisma P2002 → 409 on `jsonError`** — carried from R9 follow-up #1 and the R8 follow-up list. ✓ R10-fixed: `src/lib/server/http.ts` `jsonError` now branches on `Prisma.PrismaClientKnownRequestError.code === "P2002"` and returns 409 + `target`. All routes that use `jsonError` inherit the mapping. (Was not a separate bullet in `open-bugs.md`; recording the closure here for traceability.)
