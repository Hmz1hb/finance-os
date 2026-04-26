# Round 4 — appended 2026-04-26

7 fresh agents drove `https://finance.elhilali.dev` via Chrome MCP to re-verify the 2026-04-25 fix annotations against **live production**. Round 3's verifications were largely code-reads — Round 4 is wire-level.

## TL;DR — the deploy gap

**Every "Fix 2026-04-25" annotation in this ledger is in the local working tree but has not been committed or pushed.** `origin/main` is at `1bf392b` (chore(audit): phase 9 — tick test-data cleanup boxes; 2026-04-25 19:09:51 +0100) and the auto-deploy pipeline only fires on push to main, so production is still serving the **pre-fix bundle**. `git status` at audit time:

- 28 modified files (incl. `middleware.ts`, `globals.css`, `layout.tsx`, `nav.tsx`, `login-form.tsx`, `receipt-upload.tsx`, `cockpit.ts`, `net-worth.ts`, `health.ts`, the `(app)/{transactions,loans,goals,subscriptions,receivables,personal,income-schedules,dashboard}/page.tsx` set, `api/{transactions,import/csv,ai/receipt-ocr,payroll/pay-myself}/route.ts`, `use-form-submit.ts`, `entity-rail.tsx`, `goal-contribute-form.tsx`, `loan-payment-form.tsx`)
- 9 untracked files (incl. `sign-out-button.tsx`, `expected-income-settle-button.tsx`, `goal-row.tsx`, `loan-row.tsx`, `receivable-row.tsx`, `subscription-row.tsx`, `transaction-edit-form.tsx`, `transactions-ledger.tsx`, two new vitest files)

**Action required:** stage + commit + push. The fixes are correct in source. Re-run Round 4 after the GitHub Actions OIDC → S3 → SSM deploy completes.

## Round 4 — P0 (regressed from R3)

- [x] **P0 — [TEST-AGENT-R4-DEPLOY] All 2026-04-25 fix annotations are stale** — ✓ Resolved by R7 (root cause was Next.js 16's `middleware.ts → src/proxy.ts` rename) and R8 (every R7 fix verified live at the wire). See `07-middleware-rename.md` and `08-r7-live-verification.md`. Original report kept below as historical record. — 7 independent agents confirmed prod is at the pre-fix bundle. The R3 ledger ticks for L297 (CSRF text/plain), L360 (rate limit 30/60s), L622 (multipart 415), L758 (prefers-color-scheme), L763 (beforeunload), L778 (logout UI), L784 (login rate limit), L792 (login error string), L850 (CTA contrast), L857 (login labels), L892 (FX aggregation on debt totals), L929 (file input label), L934 (Idempotency-Key on form), L939 (Manage schedules contrast), L718 (cursor pagination on /transactions), L724 (API pagination envelope), L159 (UK LTD GBP symbol), L587 (Edit affordances on 5 list pages), L594 (Settle button on /income-schedules) all need re-verification post-deploy.

## Round 4 — verified clean (re-confirmed live, post-R3)

- L140 — CSV garbage rejected (multipart happy-path) — confirmed 400 with sanitized message (V2)
- L187 / L301 — receipt-ocr empty form / oversized — confirmed 400 / 413 (V2)
- L137 — `/api/transactions` validates negative amounts — confirmed 400 (V2)
- L378 — `/api/goals` rejects negative `targetAmount` — confirmed 400 (V2)
- L442 — `/api/loans` validation 400 (not 500) on bad enum — confirmed (V2)

## Round 4 — re-flipped to `[ ]` (premature ticks)

The following ledger lines were ticked `[x]` with `✓ Verified 2026-04-25` annotations that were code-reads or assumed-deployed; live probes today show prod still has the pre-fix behaviour. Each is flipped back to `[ ]` inline above with a `✗ R4 deploy-gap — live prod still pre-fix` note. Once the working tree is committed/pushed and the EC2 box redeploys, re-run the relevant probes from this ledger to re-tick.

L297, L360, L622, L758, L763, L778, L784, L792, L850, L857, L892, L929, L934, L939, L718, L724, L159, L587 (per-page Edit affordance), L594 (Settle button).

## Round 4 — newly-discovered residual issues (independent of deploy gap)

- [x] **P3 — [TEST-AGENT-R4-V2] Transaction Zod schema rejects deserialized Date objects** ✓ R5 fixed 2026-04-26 — root cause: Zod 4 `z.coerce.date()` runs `new Date(undefined)` on missing input, producing an `Invalid Date` instance whose `.getTime()` is `NaN`. Zod's `$ZodDate` parser then emits a paradoxical `expected date, received Date` issue (node_modules/zod/v4/core/schemas.js:637-647). Fix: `summarizeZodIssues` in src/lib/server/http.ts now detects this exact artifact (code=invalid_type, expected=date, received="Invalid Date") and rewrites it to `"Required (must be a valid date)"`. Centralized — covers all 25+ `z.coerce.date()` call sites without per-route changes. Regression test at tests/parse-json-date-envelope.test.ts. — every 400 sanitized envelope from `/api/{transactions, goals, loans, ...}` includes a stray `"Invalid input: expected date, received Date"` issue alongside the field error the test was probing. Suggests a `z.date()` somewhere in the chain is rejecting a `Date` instance (likely a `coerce.date` upstream produced one). Cosmetic — the validation still rejects bad payloads correctly — but pollutes the issue array.

- [x] **P3 — [TEST-AGENT-R4-V3] EntityRail Combined vs Cockpit Cash now still off by ~20 د.م. baseline** ✓ R5 fixed 2026-04-26 — same root cause as L903; cockpit.ts:44 now applies `date <= now`. — V3 reproduced R3's L903 finding: Combined `41.257,36 د.م.` vs Cash now `41.237,36 د.م.` (gap 20.00 today; was 10.00 yesterday). Both surfaces respond correctly to deltas; only the absolute baseline disagrees, and the gap drifts. Promote from "informational" if it grows further.

- [x] **P2 — [TEST-AGENT-R4-V2] CSV garbage error message regressed slightly** ✓ R5 fixed 2026-04-26 — `lines.length < 2` 400 now appends `Expected at minimum: amount, date`, matching the column-missing message format. csv/route.ts:29. — `/api/import/csv` now returns `"CSV must have a header row and at least one data row"` instead of R3's documented `"missing required columns: amount, date"`. Both are valid 400s but the new message doesn't tell the user *which* columns are required. Polish.

- [ ] **P2 — [TEST-AGENT-R4-N3] No virtualization regardless of pagination** — even after the L718 fix lands, `/transactions` ledger is still flat `<div>`s (no `<table>`, no `react-window`, no `@tanstack/virtual`). With cursor pagination the per-page DOM stays bounded, so this is no longer urgent — but worth flagging if Hamza ever wants infinite-scroll with stable scroll restoration.

## Round 4 — coverage map (what R4 actually touched)

| Surface | Verified live (PASS) | Verified live (FAIL — deploy gap) | Code-read only |
|---|---|---|---|
| /api/* validation envelopes | transactions / goals / loans / csv / receipt-ocr | — | — |
| /api/import/csv content-type guard | — | JSON body still 500 | — |
| /api/ai/receipt-ocr content-type guard | — | JSON body still 500 | — |
| /api/transactions CSRF (text/plain) | — | 200 (still wide open) | — |
| /api/transactions rate limit | — | 35× 200 burst | — |
| /api/transactions pagination envelope | legacy `?year=` bare-array still works | new `?cursor`/`?limit`/`?q` ignored | — |
| /transactions UI cap | — | 80 rows rendered, no Load more, no search | — |
| /transactions Idempotency-Key on form | server-side dedupe works | client form does not attach header | — |
| /dashboard FX (UK LTD GBP) | Combined `د.م.` correct | UK LTD still renders `د.م.` | — |
| /loans + /personal + /net-worth FX | gap matches across pages | all show 100,00 د.م. for 100 GBP loan (no FX) | — |
| Logout UI | — | 0 sign-out controls in DOM | sign-out-button.tsx wired |
| /api/auth/callback/credentials rate limit | — | 11× through, no 429 | — |
| /login error string | — | "ADMIN_USER / ADMIN_PASSWORD" in deployed JS chunk | — |
| Primary CTA contrast | — | 3.34:1 across 6 pages | — |
| /login form labels | — | not probed (would require sign-out) | source verified |
| Receipt scan file input label | — | bare input in deployed `/transactions?scan=1` | source verified |
| Manage schedules contrast | — | 4.40:1 (still <4.5) | — |
| `prefers-color-scheme` | — | `data-theme="dark"` hardcoded; 0 PRM rules in deployed CSS | — |
| Edit affordances on 5 list pages | — | RowActions kebab still Delete-only | row components untracked |
| Settle button on /income-schedules | — | not deployed | source verified |
| Red-risk text contrast (regression) | 7.56:1 — unchanged | — | — |

## Round 4 — cleanup

- V1: 0 records created (concurrent-tab navigation interference aborted live tests early).
- V2: 0 records (validation probes only).
- V3: 1 loan created + DELETE 204 — net zero.
- V4: 38 transactions ([TEST-AGENT-R4-V4-csrf] / -rl / -idem) + 0 idempotency residue → 38 DELETEs 204, 0 remaining.
- N1: 0 records (login probes are unauthed POSTs, no rows persisted).
- N2: 0 records (a11y probes are read-only).
- N3: 5 transactions ([TEST-AGENT-R4-N3]) + 5 DELETEs 204, 0 remaining.

**Sweep verification:** searched `/api/transactions?limit=10000` for `[TEST-AGENT-R4-` → 0 matches. Hamza's un-prefixed records untouched.

## Round 4 — note for next round

The R3 verification agents marked items `[x]` after reading the local source. That is not the same as "verified in production." Future audit rounds should:

1. Run `git status` + `git log origin/main..HEAD` first; flag uncommitted fixes as a P0 *before* re-verifying.
2. Always probe live prod with `fetch()` from the authed tab — never tick based on source code alone.
3. When a code-read is the only option (e.g. /login probe would log Hamza out), explicitly mark the tick as "code-verified, live unverified" rather than just `✓ Verified <date>`.

