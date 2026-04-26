# Open bugs

Single source of truth for what's still broken. Sorted by severity. Each entry points to its round file for the full repro / context. Last refreshed after Round 9 (2026-04-26).

When a bug is fixed, tick it here AND in its origin round file, then move it to `## Closed in this batch` at the bottom (clear that section after each commit).

---

## P0

- [ ] **Multi-tenancy `userId` missing on every owned entity** — origin: [`02-extended-coverage.md`](rounds/02-extended-coverage.md). Deferred until a 2nd account is created. `Transaction` (and every sibling) has only `entityId`, no `userId` / `tenantId`. The day a second user signs up, every query returns everyone's data. Add the column + backfill + middleware filter before that day.

## P1

- [ ] **`/reports` is a stub** — origin: [`01-original-audit.md`](rounds/01-original-audit.md). Subtitle promises charts/exports/P&L; page renders 4 stat tiles + nothing else. Feature work, not a bug fix.

## P2

- [ ] **PATCH validation parity drops `> 0` refinement on monetary fields (6 routes)** — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). `PATCH /api/transactions|loans|goals|subscriptions|receivables|owner-pay|recurring-rules/[id]` accepts `{amount: -5}` (or `originalAmount` / `targetAmount`) where matching POST rejects. DB stores negative cents; downstream math + balances corrupt silently. Categories is the only resource with full POST/PATCH parity. Fix: lift the refinement into a shared schema imported by both POST and PATCH (also closes R9-EDIT-002/003/004/005).
- [ ] **Goal contributions silently exceed target** — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). `POST /api/goals/[id]/contributions` increments `currentSavedCents` unbounded. With `targetCents=10000`, two contributions of 8000 + 5000 both 200 and end at 13000. Source: `src/app/api/goals/[id]/contributions/route.ts` issues `{increment}` with no boundary check.
- [ ] **Intermittent 502 on `/dashboard`** — origin: [`01-original-audit.md`](rounds/01-original-audit.md). Cloudflare → EC2. Pre-existing tab showed 502 at session start; subsequent loads OK. Needs ops investigation, not a code fix.
- [ ] **Cluster of 503s on RSC prefetches** — origin: [`01-original-audit.md`](rounds/01-original-audit.md). Affects `/business/tax`, `/receivables`, `/income-schedules`, `/dashboard`, `/transactions` `?_rsc=…`. Likely correlates with the 502 above.
- [ ] **"Combined" wallet card accumulates phantom negatives after failed mutations** — origin: [`01-original-audit.md`](rounds/01-original-audit.md). 0 → −85 → −35 د.م. across failed actions. Suggests partial writes on failed server actions.
- [ ] **JWT session cannot be revoked; concurrent sessions are uncoordinated** — origin: [`03-crud-verification.md`](rounds/03-crud-verification.md). NextAuth JWT strategy, no DB session table. A leaked cookie remains valid for up to 30 days. Low blast radius today (single-user); becomes account-takeover risk if a 2nd user is added.
- [ ] **No virtualization on /transactions ledger** — origin: [`04-deploy-gap.md`](rounds/04-deploy-gap.md). Less urgent now that R7 added cursor pagination; bounded DOM per page. Worth flagging only if Hamza wants infinite-scroll with stable scroll restoration.

## P3

- [ ] **`POST /api/ai/receipt-ocr` returns 415 for >10 MB body instead of documented 413** — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). 11 MB Blob → `415 "Expected multipart/form-data"`; the `request.formData()` parse fails first and the catch at `route.ts:25-27` collapses every parse failure into a generic 415. Fix: pre-check `Content-Length` before parsing, or branch on the size-limit error type.
- [ ] **React #418 hydration mismatch on `/transactions` cold load** — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). Reproducible. Likely a server vs. client text divergence in the ledger row formatter (date / locale / "x ago" relative time). No visible breakage, but produces a recoverable error and double-render.
- [ ] **50+ sub-32px touch targets on `/transactions`** — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). Select-all checkbox 13×13 px; 50× "Row actions" buttons 28×28 px. Below iOS 44 px guideline. Sampled at desktop viewport (real DevTools mobile-emulation gated from MCP); mobile responsive variant may collapse differently.
- [ ] **Generic offline error toast on transaction submit** — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). Hijacked-fetch repro shows toast "Could not save transaction." with no offline-aware copy, no retry affordance, no client-side queue (matches ground truth: no `BackgroundSync`). UX polish for a PWA.
- [ ] **Service-worker NetworkFirst on `/api/*` did not populate runtime cache** — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). Informational. Caches keys list `workbox-precache`, `finance-os-static-assets`, `start-url`; no `/api/*` runtime cache materialized after a successful `GET /api/transactions`. Either NetworkFirst handler is gated to a narrower path pattern, or page-initiated fetches bypass SW. Could be intentional cache scoping.
- [ ] **Loans `interestRate` cap missing on PATCH** — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). POST clamps `[0,1]`; PATCH only `min(0)`. PATCH allows `interestRate: 5` (= 500%). Same root cause as P2 PATCH validation parity.
- [ ] **Loans payoff cross-check missing on PATCH** — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). POST `superRefine` rejects `expectedPayoffDate <= startDate`; PATCH lacks the cross-check.
- [ ] **Goals `currentSaved >= 0` missing on PATCH** — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). POST refines; PATCH drops it. Combined with the P2 PATCH parity bug, a goal can end up with a negative `currentSavedCents`.
- [ ] **Recurring-rules `superRefine` missing on PATCH** — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). POST enforces (a) `intervalDays` for `INTERVAL_DAYS`, (b) `dayOfMonth` for `MONTHLY_DAY`/`SEMI_MONTHLY`, (c) `secondDayOfMonth` for `SEMI_MONTHLY`, (d) `endDate > startDate`. PATCH has none — a record can be flipped to `cadence: SEMI_MONTHLY` without the required day fields, breaking next-occurrence calculation.
- [ ] **`0.004 GBP` accepted with `amountCents: 0`** — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). Zod's `> 0` refinement applies to the parsed numeric value before rounding, so `0.004 → 0.004 > 0 → passes → rounds to 0`. Check should be on the rounded `amountCents` (`>= 1`).
- [ ] **`<input type="date">` only — no time component on transactions** — origin: [`02-extended-coverage.md`](rounds/02-extended-coverage.md). Storage is ISO datetime; dates are implicitly midnight in some TZ. Off-by-one display risk for TZs west of UTC. Africa/Casablanca (UTC+1) doesn't repro. R7 already fixed display-side TZ slicing — this one is about **input** granularity.
- [ ] **Ledger has no virtualization** — origin: [`02-extended-coverage.md`](rounds/02-extended-coverage.md). Largely superseded by R7 cursor pagination; per-page DOM is bounded. Same status as the P2 above.
- [ ] **Presigned attachment URLs: 1-hour expiry, no IP/Origin restrictions** — origin: [`02-extended-coverage.md`](rounds/02-extended-coverage.md). Acceptable for receipts; worth noting for future hardening.
- [ ] **Loan schema repro example in Round 1 ledger is stale** — origin: [`03-crud-verification.md`](rounds/03-crud-verification.md). Informational; the actual schema is correct, only the historical example payload is out of date.
- [ ] **Notification API never triggered for due recurring rules / receivable aging / subscription renewals** — origin: [`03-crud-verification.md`](rounds/03-crud-verification.md). Product gap, not a regression. Service Worker is cache-only; no `Notification.requestPermission()` is wired.
- [ ] **Focus-trap in the Delete-confirm dialog: not provable via automation** — origin: [`03-crud-verification.md`](rounds/03-crud-verification.md). Radix `Dialog` should trap focus by default; couldn't verify Tab cycling via synthetic events. Manual sanity check recommended.
- [ ] **`/sw.js` served with `cache-control: public, max-age=14400`** — origin: [`09-team-coverage.md`](rounds/09-team-coverage.md). Informational. CDN caches the service-worker for up to 4 hours; SW updates can lag clients by that long after a deploy. Set `cache-control: no-cache, must-revalidate` on `/sw.js` so the CDN always revalidates.

---

## Out-of-scope informational entries

These appear as `[ ]` in round files but were never bugs — they're coverage notes / verified-non-bugs / route maps. Don't fix; consider removing the leading `[ ]` next time we touch the round file:

- `03-crud-verification.md:240` — N1 Auth route map (informational)
- `03-crud-verification.md:246` — N1 Cookie attributes (verified clean)
- `03-crud-verification.md:252` — N1 Verified non-bugs (informational)
- `03-crud-verification.md:260` — N1 Coverage notes (informational)

---

## Closed in this batch

(Tick items here when you fix them, then clear the section in your closing commit.)

