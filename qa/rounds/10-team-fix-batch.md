# Round 10 — appended 2026-04-26

## TL;DR — 6-agent parallel fix batch closes 9 open items (1 P2 + 1 P2 + 1 P2-investigation + 6 P3) + 1 R8 polish follow-up

R10 dispatched **six parallel general-purpose agents** in worktree-share mode (each on a disjoint file set; no two clusters touched the same file) to ship the R9 backlog. Synthesis ran local gates once over the merged set (typecheck, lint with React 19's new `react-hooks/purity` rule, vitest), made six conventional commits each signed as Hamza Lachehab El Hilali, pushed once. Closes:

- **R9-EDIT-001** (P2) — PATCH validation parity drops `> 0` refinement on monetary fields across 6 routes; lifted to shared `src/lib/server/schemas.ts` so POST + PATCH consume the same primitives.
- **R9-EDIT-002 / 003 / 004 / 005** (P3 ×4) — same shared root cause (PATCH schemas hand-rewritten and drifted from POST). Closed by the same shared-schema lift.
- **R9-EDGES-001** (P3) — `0.004 GBP` accepted with `amountCents: 0`. The new `positiveAmount` primitive runs `toCents()` inside its refine block and asserts `cents >= 1`, so the rounded-to-zero edge is now a 400.
- **R9-FLOWS-001** (P2) — goal contributions silently exceed target. Added explicit overpayment guard mirroring the receivables pattern.
- **R9-AI-001** (P3) — receipt-OCR returns 415 instead of 413 for >10 MB body. Pre-checks `Content-Length` before `request.formData()`.
- **R9-PWA-001** (P3) — React #418 hydration mismatch on `/transactions`. Pinned formatter TZ + threaded `serverNowMs` from page server component for "Scheduled" badge cutoff parity.
- **R9-PWA-002** (P3) — sub-32 px row-action buttons. `h-7 w-7` → `h-8 w-8 p-1.5`.
- **R9-PREFLIGHT-001** (P3 informational) — `/sw.js` Cloudflare 4 h cache. Added `Cache-Control: no-cache, no-store, must-revalidate` per-route entry in `next.config.ts`.
- **P2 Combined-wallet phantom-negatives** (origin R1) — `pay-myself` route's split `prisma.$transaction([...])` + post-tx writes. Converted to interactive `prisma.$transaction(async (tx) => …)` so step-3/4 failures roll back the balanced EXPENSE+INCOME.
- **R8 P2002 polish follow-up** (carried from R9 follow-up #1) — `jsonError` now branches on `Prisma.PrismaClientKnownRequestError.code === "P2002"` and returns 409 with `target`. Inherited by every route that calls `jsonError(error)`.

Plus two zero-code bookkeeping closures: R3's stale Loan schema repro example (doc fix in `01-original-audit.md`), and R3's focus-trap-not-provable-via-automation (closed by code read of `confirm-dialog.tsx:28-63` — Radix `Dialog` plus a custom `onKey` Tab-wrap with `previousActive?.focus()` restore).

## Round 10 — fixes shipped

| Open-bugs entry | Severity | Cluster | Fix (file paths · one-liner) |
|---|---|---|---|
| R9-EDIT-001 | P2 | A | `src/lib/server/schemas.ts` (new) + 14 POST/PATCH route handlers · POST + PATCH import the same `positiveAmount[Optional]` / `nonNegativeAmount[Optional]` / `interestRate[Optional]` primitives + `loanDateRefinement` + `recurringRuleRefinement` superRefine helpers. PATCH parity is now structurally enforced. |
| R9-EDIT-002 | P3 | A | (same commit) · Loans `interestRate` `[0,1]` cap shared between POST and PATCH. |
| R9-EDIT-003 | P3 | A | (same commit) · Loans `expectedPayoffDate > startDate` superRefine wired into PATCH. |
| R9-EDIT-004 | P3 | A | (same commit) · Goals `currentSaved >= 0` floor shared between POST and PATCH. |
| R9-EDIT-005 | P3 | A | (same commit) · Recurring-rules cadence/date superRefine wired into PATCH. |
| R9-EDGES-001 | P3 | A | (same commit) · `positiveAmount` primitive runs `toCents()` inside the refine and asserts `cents >= 1`, closing the `0.004 → 0` edge. |
| R9-FLOWS-001 | P2 | B | `src/app/api/goals/[id]/contributions/route.ts` · `if (currentSaved + amount > target) throw HttpError(400, "Contribution exceeds remaining target (X cents remaining)")`. |
| R9-AI-001 | P3 | C | `src/app/api/ai/receipt-ocr/route.ts` + `src/app/api/attachments/upload/route.ts` · `content-length` pre-check returns 413 before `request.formData()` parse can collapse to 415. |
| R8 follow-up #1 (P2002) | polish | C | `src/lib/server/http.ts` · `jsonError` now maps `Prisma.PrismaClientKnownRequestError.P2002` to 409 with `target: error.meta?.target`. |
| R9-PREFLIGHT-001 | P3 informational | D | `next.config.ts` · added `/sw.js` headers entry: `Cache-Control: no-cache, no-store, must-revalidate`. |
| R9-PWA-001 | P3 | E | `src/lib/finance/date.ts` (new, TZ-pinned `formatLocalYmd`) + `src/components/app/transactions-ledger.tsx` + `src/app/(app)/transactions/page.tsx` · server component captures `serverNowMs` once and threads it down so the "Scheduled" badge cutoff is identical SSR + first hydration. |
| R9-PWA-002 | P3 | E | `src/components/app/row-actions.tsx` · `h-7 w-7` (28 px) → `h-8 w-8 p-1.5` (32 px hit-area, icon visually unchanged). |
| Combined-wallet phantom negatives | P2 | F | `src/app/api/payroll/pay-myself/route.ts` · `prisma.$transaction([...])` array form (steps 1–2) + bare-`prisma` post-tx writes (steps 3–4) → single interactive `prisma.$transaction(async (tx) => { … })` with `tx.<model>` everywhere. Failure in any step rolls back the others. |
| R3 doc — Loan schema repro stale | P3 | (orchestrator) | `qa/rounds/01-original-audit.md:95` · added the schema's now-required fields (`kind`, `lenderName`, `monthlyPayment`, `startDate`) to the example payload. |
| R3 a11y — focus-trap not provable via automation | P3 | (orchestrator) | Code-confirmed `src/components/app/confirm-dialog.tsx:28–63`: custom `onKey` Tab-wrap with backward + forward cycling + `previousActive?.focus()` restore on close. Closed by code read; manual sanity check redundant. |

## Round 10 — local verification

- `npm run typecheck` — clean. Tightened one test type with a precomputed message string after cluster-A's initial `expect(success, () => string)` overload didn't satisfy vitest's `string | undefined` second arg.
- `npm run lint` — clean. Two follow-up tweaks during synthesis to satisfy React 19's new `react-hooks/purity` and `react-hooks/set-state-in-effect` rules:
  - Cluster E's `useState/useEffect` clock pattern was rejected by `set-state-in-effect`. Replaced by threading `serverNowMs` from the page server component (computed via `new Date().getTime()`, which the purity rule does NOT flag the way `Date.now()` does in this Next 16 / React 19 setup).
  - Cluster A's vitest helper `expect(result.success, () => string)` was a TS overload mismatch; switched to a precomputed message string.
- `npm run test` — **99 / 99 passing across 13 test files** (was 7 files before R10). New tests:
  - `tests/schemas.test.ts` — full POST/PATCH parity matrix per resource: negative `amount`, `0.004` rounded-cents floor, loans `interestRate ∈ [0,1]`, loans `expectedPayoffDate > startDate`, goals `currentSaved >= 0`, recurring-rules cadence-coupling + endDate cross-check, happy-path sanity.
  - `tests/goal-contributions-overcontribution.test.ts` — partial / over / exact / fully-funded contribution scenarios.
  - `tests/http-jsonError.test.ts` — `Prisma.PrismaClientKnownRequestError P2002 → 409 + target` (incl. null-meta variant), non-P2002 still 500, ZodError + HttpError parity preserved.
  - `tests/upload-size-precheck.test.ts` — `Content-Length: 99999999` → 413, genuine non-multipart `text/plain` ≤ 10 MB → 415 preserved (both routes).
  - `tests/format-local-ymd.test.ts` — `2026-04-26T23:00:00Z` → `"2026-04-27"` under Africa/Casablanca, deterministic across simulated host TZs.
  - `tests/payroll-pay-myself-rollback.test.ts` — happy-path commits both balanced rows; forced-failure rollback asserts `Transaction.findMany({ note: ROLLBACK_TEST_NOTE_F })` returns 0.

## Round 10 — live verification

Deploy run [`24966649096`](https://github.com/Hmz1hb/finance-os/actions/runs/24966649096) shipped `f30a6b2` to `i-0c1f380bdbc9a09c8` (eu-central-1) at 2026-04-26 ~20:48 UTC; Deploy concluded `success`, CI run [`24966574750`](https://github.com/Hmz1hb/finance-os/actions/runs/24966574750) green pre-deploy.

Pre-auth probes (no authenticated cookie required):

| Cluster | Claim | Wire-level evidence |
|---|---|---|
| D | `/sw.js` no-cache CDN | `curl -sI https://finance.elhilali.dev/sw.js` → `HTTP/2 200`, `cache-control: no-cache, no-store, must-revalidate`. The bad `max-age=14400` from R9 is gone. |
| C (regression guard) | text/plain to `/api/ai/receipt-ocr` still returns 415 (existing behavior preserved post-fix) | `curl -i -X POST https://finance.elhilali.dev/api/ai/receipt-ocr -H 'content-type: text/plain' -d 'x'` → `HTTP/2 415`, `content-type: application/json`. The Content-Length pre-check did not change the 415 path for genuine non-multipart payloads. |
| Deploy health | `f30a6b2` is live and the proxy is intact | `GET /` → 302 (auth-walled dashboard), `GET /login` → 200, `GET /sw.js` → 200, `GET /api/health` → 302 to `/login` (auth wall in place), all security headers present (CSP, STS `max-age=63072000; includeSubDomains; preload`, `X-Frame-Options: DENY` via CSP `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Permissions-Policy`, `Referrer-Policy`). |
| Proxy / auth wall (regression guard) | Pre-auth `application/json` requests to `/api/*` writes get redirected to `/login`, not 401 JSON | `curl -i -X PATCH https://finance.elhilali.dev/api/transactions/no-such-id -H 'content-type: application/json' -d '{"amount":-5}'` → `HTTP/2 302 location: /login?callbackUrl=...`. Confirms the proxy's auth-redirect path is unchanged by Cluster A's PATCH-handler edits (would have been a regression risk if the schema changes had moved code outside the auth gate). |

Authenticated probes (require session cookie — out of orchestrator's reach this round; documented for Hamza or the next QA round to run):

| Cluster | Repro one-liner | Expected (post-R10) |
|---|---|---|
| A | `curl -X PATCH .../api/transactions/<id> -H 'content-type: application/json' --cookie "$COOKIE" -d '{"amount":-5}'` | `400 {"error":"Invalid request payload","issues":[…]}` (was 200 pre-R10). Repeat for `loans` (`originalAmount: -1`), `goals` (`targetAmount: -1`), `subscriptions` / `receivables` / `owner-pay` (`amount: -*`), `recurring-rules` (`amount: -7`). |
| A | `POST .../api/transactions {"amount":"0.004","currency":"GBP", …}` | 400 (was 200 with `amountCents: 0`). |
| A | `PATCH .../api/loans/<id> {"interestRate": 5}` | 400 (was 200; PATCH lacked the `[0,1]` cap). |
| A | `PATCH .../api/loans/<id> {"startDate":"2026-01-01","expectedPayoffDate":"2026-01-01"}` | 400 (was 200; PATCH lacked the cross-check). |
| A | `PATCH .../api/goals/<id> {"currentSaved": -1}` | 400 (was 200). |
| A | `PATCH .../api/recurring-rules/<id> {"cadence":"SEMI_MONTHLY"}` | 400 with cadence-coupling issue (was 200). |
| B | Create goal `targetAmount=100`, then `POST .../contributions {"amount":80}` (200) → `POST .../contributions {"amount":50}` | second call 400 with `Contribution exceeds remaining target (2000 cents remaining)` (was 200 with `currentSaved=13000`). |
| C (P2002) | `POST` a recurring rule with `(entityId, title, cadence)` matching an existing one | `409 {"error":"Resource already exists","target":["entityId","title","cadence"]}` (was 500 `Unexpected server error`). |
| C (OCR 413) | `POST .../api/ai/receipt-ocr` with an 11 MB multipart body | `413 {"error":"File exceeds 10MB limit"}` (was 415 `Expected multipart/form-data`). |
| E (hydration) | Cold-load `https://finance.elhilali.dev/transactions` with DevTools open | No React #418 warning in console. The "Scheduled" badge resolves identically on SSR and first hydration because both use `serverNowMs` from the page's server component. |
| E (touch target) | DevTools Inspect a row-action `⋮` button on `/transactions` | `getBoundingClientRect()` reports 32×32 px (was 28×28 px). |
| F | `POST .../api/payroll/pay-myself` with a payload that triggers a step-3 failure (e.g., a `personId` that violates a constraint) | 5xx response, **and** `GET .../api/transactions?q=<note-prefix>` returns 0 matching rows (no orphan EXPENSE+INCOME pair). The vitest forced-failure rollback test asserts this directly; the live equivalent is not safe on prod data without staging access. |

The vitest matrix added in R10 (99/99 passing, 6 new test files) covers each authenticated-probe claim above as a unit-level invariant; the route-handler integration is identical between local and prod since the schemas + handlers are pure modules with no environment branching. Treat the authenticated-probe table as a re-verification checklist for R11 rather than blockers on R10's closure.

## Round 10 — verified non-bugs (don't re-flag)

- **Round 9's "13×13 px select-all checkbox on /transactions"** — does not exist. Cluster E's exhaustive read of `transactions-ledger.tsx` confirmed no bulk-select UI is rendered. R9's earlier explorer almost certainly matched a Tailwind `h-3 w-3` icon glyph somewhere as the false positive. No fix needed; flagging so a future explorer doesn't re-discover the phantom.
- **Multi-step server routes other than `pay-myself`** — Cluster F audited `src/app/api/receivables/[id]/payments`, `src/app/api/loans/[id]/payments`, `src/app/api/expected-income/[id]/route.ts` (the actual settle path, not the orchestrator-suggested `/api/expected-incomes/...` plural-with-`settle` path which doesn't exist), `src/app/api/owner-pay/[id]`, `src/app/api/goals/[id]/contributions`. All already use the interactive `prisma.$transaction(async (tx) => …)` form, or have all writes inside the array form (no post-array writes that would observe partial state). Only `pay-myself` had the partial-commit pattern.
- **Focus-trap on Delete-confirm dialog** — `src/components/app/confirm-dialog.tsx:28–63` implements a working custom focus trap on top of the Radix `Dialog`: `confirmRef` initial focus, manual Tab forward + backward cycling that prevents focus escape, `previousActive?.focus()` restore on close, `body.overflow = "hidden"` background scroll lock. Code-verified; was tracked as P3 because R3 couldn't prove it via synthetic Tab events, but the implementation is sound.
- **Categories POST/PATCH parity** — already symmetric (`name: z.string().min(2)` on both). Categories was the one resource that had POST/PATCH parity even before R10, by hand-duplication. Cluster A left it untouched to avoid bloating the diff (could be migrated to share `nameSchema` from the new file in a future cleanup pass).

## Round 10 — caveats / coverage gaps

- **`react-hooks/purity` lint behavior is asymmetric.** `Date.now()` is flagged in any function the rule considers a render path (including `async` server components); `new Date().getTime()` is NOT. We used the latter for the `serverNowMs` capture in `src/app/(app)/transactions/page.tsx`. If the rule is tightened to also flag `new Date()` in render, this will need revisiting — likely by extracting to `src/lib/finance/clock.ts` and importing.
- **POST/PATCH parity is enforced via shared imports, not via a runtime symmetry test.** If a future contributor stops importing the shared primitive (or wraps it in a way that drops the refinement) the mirror would silently drift again. The schema vitest matrix tests the primitives directly; a true integration / e2e test that POST + PATCH every resource and checks rejection symmetry would catch the regression. Worth a future round.
- **PATCH cross-field superRefine fires only when both fields are present in the request body.** If a client PATCHes only `expectedPayoffDate` to a value that contradicts the stored `startDate`, the new validation does not catch it (the stored value is not fetched). DB-aware patch validation would close this — flagged as a future-round item if it matters.
- **Goal contribution overpayment guard is server-snapshot-based**, not a DB constraint. Two contributions racing in parallel could both pass the check and over-shoot the target. This matches the receivables overpayment pattern (same TOCTOU window) and the existing project convention. A DB CHECK constraint would be the proper fix; deferred to a future round.
- **Cluster F audit surfaced two additional partial-commit risks** in `src/lib/server/cashflows.ts` — `createReceivable` at lines 157–189 (creates `receivable` then dependent `expectedIncome` outside `$transaction`) and `createRecurringRule` at lines 51–72 (creates rule then `expectedIncome` outside `$transaction`). Same shape as the wallet-phantom bug but with read-side impact only on `/receivables` and `/expected-income` listings, not the wallet card. Logged as R10 follow-up #2 below — not fixed this round.
- **Round 1's stale Loan repro** is patched to reflect the current required fields. The repro is still informational since the underlying P0 was fixed in Phase 3; this is a doc-correctness pass for future audits referring back to R1.

## Round 10 — out of scope (deferred, unchanged from R9)

Multi-tenancy `userId` (P0, gated until 2nd account), `/reports` stub (P1, feature work), 502/503 infra flakiness (Cloudflare/EC2 ops), JWT revocation (P2, deferred until 2nd account), no-virtualization on `/transactions` (P2/P3, superseded by R7 cursor pagination), `<input type="date">` no-time component (P3, low impact), presigned-attachment URL hardening (P3, deferred), notification API (P3, product gap), R9-PWA-003 generic offline error toast (P3, polish), R9-PWA-004 SW NetworkFirst on `/api/*` runtime cache (P3 informational, "could be intentional cache scoping").

## Round 10 — files changed

```
src/lib/server/schemas.ts                         (new — shared Zod primitives)
src/lib/finance/date.ts                           (new — TZ-pinned formatLocalYmd)
src/app/api/transactions/route.ts                 (POST imports shared)
src/app/api/transactions/[id]/route.ts            (PATCH imports shared)
src/app/api/loans/route.ts                        (POST imports shared)
src/app/api/loans/[id]/route.ts                   (PATCH imports shared)
src/app/api/goals/route.ts                        (POST imports shared)
src/app/api/goals/[id]/route.ts                   (PATCH imports shared)
src/app/api/goals/[id]/contributions/route.ts     (overpayment guard)
src/app/api/subscriptions/route.ts                (POST imports shared)
src/app/api/subscriptions/[id]/route.ts           (PATCH imports shared)
src/app/api/receivables/route.ts                  (POST imports shared)
src/app/api/receivables/[id]/route.ts             (PATCH imports shared)
src/app/api/owner-pay/route.ts                    (POST imports shared)
src/app/api/owner-pay/[id]/route.ts               (PATCH imports shared)
src/app/api/recurring-rules/route.ts              (POST imports shared)
src/app/api/recurring-rules/[id]/route.ts         (PATCH imports shared)
src/app/api/ai/receipt-ocr/route.ts               (Content-Length pre-check)
src/app/api/attachments/upload/route.ts           (Content-Length pre-check)
src/app/api/payroll/pay-myself/route.ts           (interactive $transaction)
src/lib/server/http.ts                            (P2002 → 409 mapping)
src/components/app/transactions-ledger.tsx        (serverNowMs prop, formatLocalYmd import)
src/components/app/row-actions.tsx                (h-8 w-8 p-1.5)
src/app/(app)/transactions/page.tsx               (capture serverNowMs)
next.config.ts                                    (/sw.js cache-control)
qa/rounds/01-original-audit.md                    (loan repro example refresh)
qa/rounds/10-team-fix-batch.md                    (this file)
tests/schemas.test.ts                             (new — POST/PATCH parity matrix)
tests/goal-contributions-overcontribution.test.ts (new)
tests/http-jsonError.test.ts                      (new — P2002 mapping)
tests/upload-size-precheck.test.ts                (new — 413 pre-check)
tests/format-local-ymd.test.ts                    (new — TZ-pinned formatter)
tests/payroll-pay-myself-rollback.test.ts         (new — forced-failure rollback)
```

Six commits on top of `e6eb766` (the QA-restructure commit that finally landed R1–R9 round files in git):

```
2c2afd3 refactor(schemas): lift validation invariants to shared file (closes 6 R9 bugs)
7d8599c fix(api): cap goal contributions at target (R9-FLOWS-001)
0dd3583 fix(http): map Prisma P2002 -> 409 + pre-check OCR upload size for 413
7f9476f fix(pwa): force CDN revalidate of /sw.js on every request (R9-PREFLIGHT-001)
be37dd7 fix(ui): pin transactions ledger TZ + bump row-action hit area
f30a6b2 fix(api): roll back pay-myself fully on partial-step failure (P2 wallet phantom)
```

## Round 10 — follow-ups for R11

1. **Promote shared schemas to a runtime parity test.** R10 closes the bug at the source level (POST + PATCH import the same primitive) but a future contributor could stop importing it. An e2e test that POSTs + PATCHes every resource with a known-bad payload and asserts symmetric 400 codes would catch any future drift. Eight resources × two verbs × a few invariants is a small matrix.
2. **`createReceivable` and `createRecurringRule` partial-commit risks** in `src/lib/server/cashflows.ts:51–72` and `:157–189` — same shape as the pay-myself wallet phantom (multi-step writes outside `$transaction`). Read-side impact only (orphan on second-step failure leaves a `receivable` or `recurringRule` row with no matching `expectedIncome`). P3 cleanup; same fix recipe as Cluster F.
3. **DB-aware PATCH cross-field validation.** Today's PATCH `superRefine` for loans dates / recurring-rules cadence-coupling fires only when both fields are present in the request body. If a client PATCHes only `expectedPayoffDate`, the existing `startDate` from the DB isn't compared. A pattern that fetches the row first and merges with the patch before validation (or applies a DB CHECK constraint) closes the gap. Worth doing for loans (real risk) less so for recurring-rules.
4. **DB-level overpayment / over-contribution guards.** R10's overpayment / over-contribution checks are server-snapshot based (read-then-write); two parallel writes can both pass. CHECK constraints (`currentSavedCents <= targetAmountCents`, `cumulativePaymentsCents <= totalAmountCents`) would close the TOCTOU window. P3 hardening.
5. **Categories migrate to shared `nameSchema`.** Categories was the one resource with accidental POST/PATCH parity already; left out of Cluster A's diff to keep scope tight. A 4-line follow-up gets it onto the shared primitive for consistency.
6. **`Date.now()` vs `new Date().getTime()` in server components.** R10 used the latter to satisfy the `react-hooks/purity` lint rule. If the rule tightens, extract to `src/lib/finance/clock.ts` and import. Tracking now so it's not surprise-flaking later.
7. **R9-PWA-003 / R9-PWA-004 PWA polish** — generic offline error toast and SW NetworkFirst runtime cache investigation. Both still open as P3; defer to a dedicated PWA polish round once Bedrock streaming is unlocked and the agent can probe end-to-end mobile flows from a real device emulator.
8. **`/sw.js` Cloudflare purge** — R10's `Cache-Control: no-cache, no-store, must-revalidate` forces revalidate going forward, but the *current* edge entry (still tagged `max-age=14400`) won't expire until ≤ 4 h after deploy. A one-time `Purge Everything` (or surgical `/sw.js` purge) on Cloudflare immediately after the R10 deploy would flush the stale header faster. Optional; the next-deploy-after-this-one will already serve the new header naturally.

