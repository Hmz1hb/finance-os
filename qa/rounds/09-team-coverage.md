# Round 9 — appended 2026-04-26

## TL;DR — all 6 R7/R8 fixes re-verified live; team-of-agents covered flows / edit / mobile-PWA / AI / edges; 11 new findings (0 P0 / 0 P1 / 2 P2 / 8 P3 / 1 informational)

Round 9 ran two waves against the deployed bundle (`fc85164` → success 13:48Z, with `dd1f76e`'s migration commit applied; no source delta since R8). Wave 1 dispatched **four parallel agents** (FLOWS, EDIT, MOBILE-PWA, AI-BEDROCK) with collective writes capped under the 30/60s/user bucket; Wave 2 dispatched the **EDGES** agent alone for the bucket-burning probes. All six R7/R8 fixes hold at the wire: text/plain → 415, `?year=` envelope, RecurringRule duplicate → P2002, DST midnight-local, write rate-limit recovery (30×200 + 31st = 429 retry-after=58, recovery 200 after 63.6s), and login bruteforce + recovery (11th = 429 retry-after=900, recovery 302 after 905s). Two P2 bugs discovered: (a) **PATCH validation parity** — every PATCH route drops the POST schema's `> 0` refinement on monetary fields, so a client can write negative `amountCents` / `originalAmountCents` / `targetAmountCents` to the DB across 6 routes; (b) **goal over-contribution** — `currentSavedCents` increments unbounded past `targetCents`. Eight P3 polish/correctness bugs and one informational follow-up round it out. Cleanup landed with 0 prefixed records across all resources and Hamza's data confirmed unchanged (100+ transactions, 2 active recurring rules — matches the pre-round baseline).

## Round 9 — re-verified live (R7/R8 fixes still hold on `fc85164`)

| Ledger line | What was claimed | R9 wire-level evidence |
|---|---|---|
| L297 / L1137 — CSRF text/plain | proxy returns 415 on non-JSON write | `POST /api/transactions` with `Content-Type: text/plain` → **HTTP/2 415** body `{"error":"Content-Type must be application/json"}`. CSP, STS (`max-age=63072000; includeSubDomains; preload`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Permissions-Policy`, `Referrer-Policy: strict-origin-when-cross-origin` all present. Probed pre-auth from curl. |
| L724 / L1149 — legacy `?year=` | bare array, not envelope | FLOWS R1: `GET /api/transactions?year=2026` → `Array.isArray === true`, length 14; control `GET /api/transactions?limit=10` → `{data, nextCursor}`, `data.length === 10`. |
| L1187 — RecurringRule partial-unique | duplicate `(entityId, title, cadence)` rejected via P2002 | FLOWS R2: `POST /api/recurring-rules` with `(entityId:"uk_ltd", title:"Azlotv LLC", cadence:"SEMI_MONTHLY")` → **HTTP 500** `{"error":"Unexpected server error"}` (P2002 falls through `jsonError`'s generic branch as R8 noted; constraint trip is real, error-mapping polish still pending — see follow-ups). Constraint live, no rule was inserted. |
| L1173 — DST midnight-local | local-TZ formatting, not UTC slice | FLOWS R3: stored `date=2026-04-26T23:00:00.000Z`; UTC slice = `2026-04-26`; `Intl.DateTimeFormat('en-CA', {timeZone:'Africa/Casablanca'})` renders **`2026-04-27`**. `formatLocalYmd` at `src/components/app/transactions-ledger.tsx:41-48` still wired and correct. Row deleted on cleanup. |
| L360 / L1143 — write rate-limit recovery | 30 writes/60s/user, then 429, recovery on window flip | EDGES E2: 30 × **200**, 31st = **429** body `{"error":"Too many requests. Retry after 58s."}` with `retry-after: 58`. Sleep 63 s, POST again → **200** id `cmofvo4fm001q1nmkabc54egt`, elapsed 63.6 s from 429. Hard-reset behavior (per `src/proxy.ts:31` `if (!bucket || now - bucket.windowStart > windowMs)`) confirmed at the wire. |
| L784 / L1145 — login-bruteforce 10/IP/15min + recovery | 11th anon login → 429 with `retry-after ≈ 600+`, recovery on window flip | EDGES E3: 10 × `302 → /login?error=...` (opaqueredirect), 11th = **429** body `{"error":"Too many login attempts. Retry after 900s."}` with `retry-after: 900`. Sleep 905 s, POST again → **302** (NextAuth redirect, not 429), elapsed 905.4 s. Same hard-reset on `LOGIN_LIMIT_WINDOW_MS=900_000`. |

## Round 9 — new bugs

### P2

- **R9-EDIT-001 — PATCH validation parity drops `> 0` refinement on monetary fields (6 routes)** — origin: this round, EDIT agent.
  - **Repro**: `PATCH /api/transactions/<id>` with `{amount: -5}`; same shape on `/api/loans/<id>` with `{originalAmount: -1}`, `/api/goals/<id>` with `{targetAmount: -1}`, `/api/subscriptions/<id>` with `{amount: -2}`, `/api/receivables/<id>` with `{amount: -3}`, `/api/owner-pay/<id>` with `{amount: -4}`, `/api/recurring-rules/<id>` with `{amount: -7}`. Live-verified writes to DB.
  - **Expected**: 400 with the same `Amount must be greater than 0` (or equivalent) Zod error that the matching POST schema returns.
  - **Actual**: 200; DB stores negative `amountCents` / `originalAmountCents` / `targetAmountCents`.
  - **Severity**: P2 — silent data corruption via legitimate API; downstream MAD-equivalent math, charts, totals, balances all break. Confirmed live on 6 PATCH routes; categories was the one resource with full POST/PATCH parity.
  - **Root cause**: each PATCH route in `src/app/api/<resource>/[id]/route.ts` rewrites the amount field as `z.union([z.string(), z.number()]).optional()` and drops the `.refine(value > 0)` that the matching POST schema enforces.
  - **Fix sketch**: lift the `> 0` refinement into a shared schema (or copy it into each PATCH schema). The same pattern fixes R9-EDIT-002 / 003 / 004 / 005 below.

- **R9-FLOWS-001 — Goal over-contribution silently exceeds `targetCents`** — origin: this round, FLOWS agent (F4).
  - **Repro**: create a goal with `targetAmount=100.00 MAD` (`targetCents=10000`). POST `/api/goals/<id>/contributions` `{amount:"80.00"}` → 200, `currentSavedCents=8000`. POST `{amount:"50.00"}` → 200, `currentSavedCents=13000` (30% over target).
  - **Expected**: second contribution rejects (or, at minimum, returns a flag) once `currentSavedCents` would exceed `targetAmountCents`.
  - **Actual**: both succeed; saved-progress signal silently corrupts.
  - **Severity**: P2 — corrupts the goal-progress signal that downstream UI/insights depend on. Not a money-loss vector, but breaks the contract goals are supposed to model.
  - **Source**: `src/app/api/goals/[id]/contributions/route.ts` issues `{ increment: amountCents }` with no boundary check.

### P3

- **R9-AI-001 — `POST /api/ai/receipt-ocr` returns 415 for body > 10 MB instead of the documented 413** — origin: AI-BEDROCK agent (A6).
  - **Repro**: POST `/api/ai/receipt-ocr` with an 11 MB random Blob → **HTTP 415** `{"error":"Expected multipart/form-data"}`. 9 MB control returns 503 (Bedrock gated, not a 415). Latency 3230 ms suggests the body is read fully before failing.
  - **Expected**: `413 "File exceeds 10MB limit"` per `src/app/api/ai/receipt-ocr/route.ts:30`.
  - **Actual**: `415 "Expected multipart/form-data"`. `request.formData()` throws first (presumably hitting a Next/Node body-size limit), and the catch at lines 25-27 collapses every parse failure into a generic 415.
  - **Fix sketch**: detect the size-limit error type or pre-check `request.headers.get('content-length')` before parsing.

- **R9-PWA-001 — React #418 hydration mismatch on `/transactions` cold load** — origin: MOBILE-PWA agent.
  - **Repro**: navigate to `/transactions` from a cold tab; minified React error #418 ("text content mismatch") thrown from `4bd1b696-c2f6e0877b6c10aa.js` shortly after the page settles. Reproducible.
  - **Expected**: zero hydration warnings on a stable production build.
  - **Likely root cause**: server vs. client text divergence in a transaction row or header — date / locale / currency formatter or "x ago" relative time. R7's `formatLocalYmd` likely has a server/client TZ split that emits different strings on first SSR vs first hydration.
  - **Severity**: P3 (medium-leaning) — no visible breakage, but produces a recoverable error and double-render; worth tracking down before it hides a real layout issue.

- **R9-PWA-002 — 50+ sub-32px touch targets on `/transactions`** — origin: MOBILE-PWA agent.
  - **Repro**: at `/transactions`, the select-all checkbox is 13×13 px and 50× "Row actions" buttons are 28×28 px. Below the 32 px soft threshold and well below iOS's 44 px guideline.
  - **Severity**: P3 mobile UX. Recommendation: inflate hit-area via `padding`/`::before` rather than visual size, so the desktop look is preserved.
  - **Caveat**: sampled at desktop viewport (3432 px) because real DevTools `Emulation.setDeviceMetricsOverride` is not exposed via the in-page JS context. Mobile responsive variant may collapse differently.

- **R9-PWA-003 — Generic "Could not save transaction." on offline submit** — origin: MOBILE-PWA agent (P8).
  - **Repro**: hijack `window.fetch` to reject with `TypeError: Failed to fetch` (simulating offline), submit the transactions/new form. Toast and inline error region both render `"Could not save transaction."` — no offline-aware copy, no retry affordance, no client-side queue.
  - **Severity**: P3 informational — matches ground truth (no `BackgroundSync`), but worth a UX pass for a PWA: read `navigator.onLine` and surface "You appear to be offline" so the user knows it's connectivity vs. server rejection.

- **R9-PWA-004 — Service worker NetworkFirst on `/api/*` did not populate runtime cache** — origin: MOBILE-PWA agent (informational).
  - **Repro**: `navigator.serviceWorker.controller` is active+activated; `caches.keys()` returns `workbox-precache-v2-...` (108 entries), `finance-os-static-assets` (7), `start-url` (1). After a successful `GET /api/transactions?limit=1` from a controlled tab, **no `/api/*` runtime cache populated** in any of the 3 caches.
  - **Likely**: the NetworkFirst handler is gated to a narrower path pattern, or page-initiated fetches bypass the SW. Worth a dev-side spot-check; could be intentional cache scoping. Not flagged P0/P1 because the documented offline behavior is "graceful degradation, not full offline-first".

- **R9-EDIT-002 — Loans `interestRate` cap missing on PATCH** — code-confirmed, source `src/app/api/loans/[id]/route.ts`. POST clamps to `[0, 1]` ("Use a decimal rate (0.05 = 5%)"); PATCH only enforces `min(0)`. PATCH allows `interestRate: 5` (= 500%). P3 correctness; same root cause as R9-EDIT-001 (PATCH schema diverges from POST).

- **R9-EDIT-003 — Loans payoff cross-check missing on PATCH** — code-confirmed. POST `superRefine` rejects `expectedPayoffDate <= startDate`; PATCH lacks the cross-check, so PATCH can flip `expectedPayoffDate` to any value. P3 correctness.

- **R9-EDIT-004 — Goals `currentSaved >= 0` missing on PATCH** — code-confirmed. POST refines `currentSaved >= 0`; PATCH drops it. P3 correctness — combined with R9-EDIT-001's negative-amount asymmetry, a goal can end up with a negative `currentSavedCents`.

- **R9-EDIT-005 — Recurring-rules `superRefine` missing on PATCH** — code-confirmed. POST `superRefine` enforces (a) `intervalDays` required for `INTERVAL_DAYS`, (b) `dayOfMonth` for `MONTHLY_DAY` / `SEMI_MONTHLY`, (c) `secondDayOfMonth` for `SEMI_MONTHLY`, (d) `endDate > startDate`. PATCH has none of these — a record can be flipped to `cadence: SEMI_MONTHLY` without the required day fields, leaving the next-occurrence calculation undefined. P3 correctness.

- **R9-EDGES-001 — `0.004 GBP` accepted with `amountCents: 0`** — origin: EDGES agent (E6).
  - **Repro**: `POST /api/transactions {amount: "0.004", currency: "GBP", ...}` → 200, `amountCents: 0`, `madEquivalentCents: 0`. By contrast `0.005 GBP` rounds to 1 cent (half-up), and `1e10 MAD` is rejected at the boundary.
  - **Severity**: P3 — a zero-amount transaction is meaningless; the Zod schema's `> 0` refinement (which exists on POST per R9-EDIT-001's analysis) appears to apply to the parsed numeric value before rounding, so `0.004 → 0.004 > 0 → passes refinement → rounds to 0`. The check should be on the rounded `amountCents` (`>= 1`) or on the absolute value with explicit precision rules.

### Informational

- **R9-PREFLIGHT-001 — `/sw.js` is served with `cache-control: public, max-age=14400`** — origin: this round, pre-flight curl probe.
  - **Repro**: `curl -I https://finance.elhilali.dev/sw.js` → `cache-control: public, max-age=14400`.
  - **Implication**: a fresh SW deploy can be cached at the Cloudflare edge for up to 4 hours; existing clients won't pick up the new SW until the CDN cache expires (or until the SW itself fetches with a cache-busting query). NetworkFirst on `/api/*` is unaffected, but any change to caching strategy / precache list / runtime handlers is delayed by up to 4 h.
  - **Severity**: informational, not a regression — flagging so it's captured if a future SW change needs to roll out promptly.

## Round 9 — verified non-bugs (don't re-flag in R10)

- **Bedrock 503 `AI_UNAVAILABLE`** on `/api/ai/chat` and `/api/ai/receipt-ocr` is the long-standing Bedrock gating issue (per round prompt's hard rule). The route correctly maps multiple upstream Bedrock errors to a uniform 503 + `AI_UNAVAILABLE` response (`src/app/api/ai/chat/route.ts:12-19`, `src/app/api/ai/receipt-ocr/route.ts:7-13`). Not a new bug.
- **Zod 8000-char cap** on `/api/ai/chat`: 8000 accepted (200 → Bedrock), 8001 rejected with clean schema-level 400 in 106 ms (vs ~220 ms for accepted). Client cap (4000) is UX-only as designed.
- **`/api/ai/insights`** works correctly without Bedrock — `MONTHLY_SUMMARY` content is locally derived from `financialContextSnapshot()`. POST 200 + GET list contains the new insight.
- **Last-write-wins on concurrent PATCH** (transactions): two simultaneous PATCH requests both 200; final `notes` = last-arriving body. Confirms documented "no `If-Match` / version / `updatedAt` concurrency guard" — by design, not a bug.
- **Soft-delete contract**: 7 of 8 resources soft-delete (`deletedAt`-based 404 on subsequent GET, filtered out of list). Owner-pay is hard-delete (`prisma.ownerCompensation.delete`) — 204 + 404 on re-GET, behavior is consistent from the API consumer's perspective.
- **Categories validation parity**: PATCH `{name: "A"}` rejected with the same 400 + Zod-shape `Too small: expected string to have >=2 characters` as POST. Categories is the only resource with full POST/PATCH parity.
- **Subscriptions `status` field on PATCH only**: PATCH adds `status` (and side-effect `cancelledAt = now` when `status === "CANCELLED"`) that POST lacks. Deliberate state-transition extension for cancel flows, not an asymmetry to flag.
- **Pay-myself FX disclosure** (`/api/owner-pay`): response surfaces `exchangeRateSnapshot` (e.g. `9.26482226`) and `madEquivalentCents`; both business EXPENSE + personal INCOME legs carry the same rate + MAD equivalent. Math: `100 USD * 9.26482226 = 926.48 MAD = 92648 cents` ✓.
- **Receivable overpayment guard**: explicit `400 "Payment exceeds outstanding balance (X cents remaining)"` per `src/app/api/receivables/[id]/payments/route.ts:31-33`. Live-verified.
- **Loan payment atomicity**: payment with `principal+interest=amount` correctly drops `remainingBalanceCents` by `principalCents` inside the same `$transaction`, creates the EXPENSE row, creates the `loanPayment` row. Mismatch (`principal+interest != amount`) → `400 "Principal + interest must equal total payment amount"`. Live-verified.
- **Settle expected-income idempotency**: first settle 200 → INCOME txn created; second settle **409 `"Expected income is already settled"`** — not silent, not duplicate insert. Live-verified.
- **Idempotency-Key TTL = 60 s exactly**: at TTL+7s with the same key + body, a **new id** is returned (not 4xx, not the cached id). EDGES E4 evidence: id_a `cmofvokat001r1nmk8jccyos1` at `14:43:12.965Z`, id_b `cmofvq0cg001s1nmkw6kng6e9` at `14:44:20.416Z`, both with identical `date: 2026-04-26T14:43:12.766Z`. Confirms ground truth from `src/app/api/transactions/route.ts:13-14, 116-162`.
- **Soft-delete shape (E5)**: `transactions` and `recurring-rules` both: create 200 → DELETE 204 → GET `<id>` **404** (`{"error":"Transaction not found"}` / equivalent), list filters out. EDIT agent independently verified categories + every other PATCH-touched resource. **Consistent across all surfaces probed.**
- **Currency edges**: `0.01 GBP → amountCents=1` ✓, `0.005 GBP → amountCents=1` (half-up) ✓, FX 100 USD/MAD = `92648` cents at rate `9.26482226` (math: round(10000 * 9.26482226) = 92648) ✓, `1e10 MAD → 400 "Amount must be > 0 and within reasonable bounds"` ✓ (boundary enforcement at `MAX_AMOUNT_CENTS = 1e12`). The edge-case `0.004 GBP → 0` is the new bug R9-EDGES-001 above; everything else is by design.
- **JWT inspection (E7)**: cookie `__Secure-authjs.session-token` is `httpOnly` + `Secure` + `SameSite=Lax` (per `auth.ts:28-33`, also confirmed in pre-flight Set-Cookie traces); NextAuth v5 default JWE format (5-segment, encrypted with NEXTAUTH_SECRET-derived key, opaque to JS); `maxAge` not set in `auth.ts` → 30-day default. Proxy `src/proxy.ts:69-81` only checks `Boolean(req.auth)` — no DB-backed session lookup, no revocation list. **Confirms the existing P2 in `open-bugs.md` ("JWT cannot be revoked")**; not a new bug.
- **PWA layer healthy**: SW `/sw.js` registered, scope `/`, active+activated; manifest matches expectations exactly (display=standalone, start_url=/dashboard, 192/512 + maskable icons, theme `#1B1F2A`); `/offline` route renders the documented offline card; 12/13 scoped routes render server-side cleanly with no console noise (the 13th is the `/transactions` hydration mismatch, R9-PWA-001).
- **`beforeinstallprompt` not firing within 5 s of nav** in headless Chrome: expected browser behavior (engagement heuristic), not a regression.
- **No `__Secure-*` cookie leakage** in any cached response URL: cache contents are static-asset or document URLs only.
- **All 13/13 scoped routes** (incl. `/offline`) emit a real `<main>` element on first SSR — no client-only shells.
- **`DELETE /api/<resource>/<id>` requires `Content-Type: application/json`** — `fetch(..., {method:'DELETE'})` without the header → **415**; same call with the header → 204. **By design**: the proxy's CSRF guard at `src/proxy.ts:90-91` enforces JSON content-type on every non-safe method (POST / PUT / PATCH / DELETE), and the rule is uniform rather than carved out for body-less verbs. EDGES E5 confirmed the same behavior across 3 resources. FLOWS agent initially flagged this as a P3 bug; on review it's the documented CSRF guard fired on a body-less verb. Tracked as a polish opportunity (carve out DELETE without weakening CSRF defense — DELETE has no body so there's no token-in-body to validate) under follow-up #5 below, not a bug.

## Round 9 — caveats / coverage gaps

- **EDGES agent reported in two phases.** The agent's intermediate harness summary (at ~8.5 minutes runtime, mid-15-min login-recovery sleep) showed only a partial trace, which the synthesis initially read as "deferred". The agent then completed all probes at 140.8 s of additional runtime and posted its full report; this round file reflects the full evidence including the live login-bruteforce re-verification + recovery. Lesson for R10: don't conclude an agent is incomplete from intermediate harness output — wait for `<status>completed</status>` with a structured report or a clear empty-result before falling back.
- **Mobile emulation degraded.** True DevTools `Emulation.setDeviceMetricsOverride` is gated from the in-page JS context, so the touch-target audit (R9-PWA-002) was sampled at the desktop viewport (3432 px). On a real mobile device the responsive variant may collapse differently. Recommendation: the next mobile-PWA pass should drive a real headless Chromium with mobile-emulation flags rather than the in-page MCP tool.
- **Multi-instance idempotency cache behavior** cannot be probed from outside the single EC2. R9 confirmed the documented 60-second TTL on a single process; if `i-0c1f380bdbc9a09c8` is ever scaled to >1 instance, both the rate-limit `Map` and the idempotency `Map` become per-process and lose cross-instance dedup. Worth flagging in R10 if autoscaling lands.
- **Bedrock gating** blocked the AI-BEDROCK agent's streaming TTFB and OCR-population probes; only the Zod-cap matrix and the receipt-OCR file-size cap (R9-AI-001) were exercisable. Once the Bedrock model-use-case form is resubmitted/approved for AWS account 810500878308, the streaming + OCR-extraction probes should be re-run.

## Round 9 — out of scope (deferred, unchanged from R8)

Multi-tenancy `userId`, `/reports` stub, 502/503 infra flakiness, virtualization, JWT revocation (probed inspection-only this round, confirms existing P2), notification API — same deferral rationale as R8. None of these moved this round.

## Round 9 — cleanup

| Probe / agent | Created | Deleted | Leftover |
|---|---|---|---|
| Pre-flight baseline sweep | 0 | 0 | 0 |
| Wave 1 — FLOWS | 7 transactions, 1 receivable, 1 loan, 1 goal, 1 owner-pay, 1 expected-income, 1 recurring-rule | All (7+5 explicit + 2 cascaded 404s, all 204 / 404 expected) | 0 |
| Wave 1 — EDIT | 8 list-page records (one per resource) + 41 writes total | All 8 records (204 each) | 0 |
| Wave 1 — MOBILE-PWA | 0 (offline form-submit was hijacked at `fetch` layer) | n/a | 0 |
| Wave 1 — AI-BEDROCK | 0 prefixed transactions / conversations; 1 unprefixed `MONTHLY_SUMMARY` insight (no DELETE endpoint exists) | 0 transactions to delete; 0 conversations created | 0 prefixed; 1 unprefixed insight (see follow-ups) |
| Wave 2 — EDGES | ≥30 transactions tagged `[TEST-AGENT-R9-EDGES-RL/IDEMP/CUR/RECOVERY]` + 1 recurring-rule (`-SD-RR`) created mid-stall | Mix of EDGES self-cleanup (≥20 deletes before stall) + R9 orchestrator cleanup loop (7 final deletes) + 1 recurring-rule cleanup at synthesis | 0 |
| Wave 2 — orchestrator follow-ups (E5/E6/E7 for missed probes) | 1 transaction (`-SD-TX`), 1 recurring-rule (`-SD-RR`) | 1 + 1 (204 each) | 0 |
| **Total** | ≥50 prefixed records (transactions + 1 each across 6 resource types) | Same | **0** |

**Final cross-resource sweep (`GET /api/transactions?limit=500&q=[TEST-AGENT-R9-` + bare-array list endpoints for receivables / loans / goals / subscriptions / categories / owner-pay / recurring-rules):** 0 prefixed records anywhere. Hamza's data confirmed unchanged: 100+ active transactions (cursor pagination indicates more), 2 active recurring rules — matches the pre-round baseline.

## Round 9 — coverage map

| Surface | R9 result |
|---|---|
| R7/R8 — text/plain → 415 | **PASS** (live, pre-flight curl) |
| R7/R8 — `?year=` legacy bare-array | **PASS** (live, FLOWS R1) |
| R7/R8 — RecurringRule partial-unique + P2002 | **PASS** (live, FLOWS R2 — constraint trips, error-mapping polish still pending per R8 follow-up #1) |
| R7/R8 — DST midnight-local | **PASS** (live, FLOWS R3) |
| R7/R8 — write rate-limit + recovery | **PASS** (live, EDGES E2 — 30×200, 31st 429 retry-after=58, recovery 200 after 63.6s) |
| R7/R8 — login bruteforce + recovery | **PASS** (live, EDGES E3 — 11th 429 retry-after=900, recovery 302 after 905s) |
| FLOWS — pay-myself FX disclosure | **PASS** |
| FLOWS — receivable round (full / partial / over) | **PASS** |
| FLOWS — loan payment atomicity | **PASS** |
| FLOWS — goal contribution | **NEW BUG** (R9-FLOWS-001 — over-contribution unguarded) |
| FLOWS — settle expected-income idempotency | **PASS** (409, not silent) |
| EDIT — 8 resources × create / PATCH save / delete | **PASS** (8/8) |
| EDIT — POST/PATCH validation parity | **NEW BUG** (R9-EDIT-001 P2 across 6 routes; categories is the only fully-symmetric resource) |
| EDIT — loans/goals/recurring-rules deeper schema parity | **NEW BUGS** (R9-EDIT-002 / 003 / 004 / 005, code-confirmed) |
| EDIT — concurrent PATCH | **PASS** (last-write-wins, by design) |
| MOBILE-PWA — nav walk (13 routes) | 12/13 PASS, **NEW BUG** (R9-PWA-001 — `/transactions` hydration mismatch) |
| MOBILE-PWA — SW + manifest + offline | **PASS** (SW healthy, manifest correct, /offline renders) |
| MOBILE-PWA — touch targets on /transactions | **NEW BUG** (R9-PWA-002 — 50+ sub-32px) |
| MOBILE-PWA — offline form-submit UX | **NEW BUG** (R9-PWA-003 — generic toast, no offline-aware copy) |
| MOBILE-PWA — `/api/*` runtime SW cache | **NEW BUG** (R9-PWA-004 — informational, did not populate) |
| MOBILE-PWA — `beforeinstallprompt` | by design (engagement heuristic) — **PASS** |
| AI-BEDROCK — chat sanity | Bedrock **GATED** (known) |
| AI-BEDROCK — Zod 8000-char cap | **PASS** |
| AI-BEDROCK — receipt OCR small image | Bedrock GATED (known) |
| AI-BEDROCK — receipt OCR 11 MB | **NEW BUG** (R9-AI-001 — 415 instead of 413) |
| AI-BEDROCK — insights POST/GET | **PASS** (locally generated, no Bedrock) |
| AI-BEDROCK — streaming TTFB | DEFERRED (Bedrock gated) |
| EDGES — idempotency TTL = 60 s | **PASS** (TTL+7s = new id) |
| EDGES — soft-delete shape (transactions / recurring-rules / categories) | **PASS** (all 404 on subsequent GET) |
| EDGES — currency edges | 4 PASS + **NEW BUG** (R9-EDGES-001 — 0.004 GBP → amountCents=0) |
| EDGES — JWT inspection (long-session) | **PASS** (confirms existing P2; no new finding) |
| Pre-flight — `/sw.js` cache headers | **NEW BUG** (R9-PREFLIGHT-001 — informational, max-age=14400) |
| DELETE without Content-Type header | by design (CSRF guard fires on body-less verbs); polish opportunity in follow-up #6 |

## Round 9 — follow-ups for R10 (not bugs)

1. **Polish: P2002 → 409 on RecurringRule duplicate-create.** R8's follow-up #1 still open — the current `500 "Unexpected server error"` is correct in that the constraint trips, but a typed `PrismaClientKnownRequestError` branch in `src/lib/server/http.ts:jsonError` would turn the UX from "something broke" into "you already have one". Branch: `if (error instanceof PrismaClientKnownRequestError && error.code === "P2002")` → 409 + `target: error.meta?.target`. Applies to every `@@unique` model.
3. **Lift the `> 0` refinement (and other shared invariants) into a single Zod schema.** R9-EDIT-001 / 002 / 003 / 004 / 005 all share the same root cause: PATCH schemas are hand-rewritten and drift from POST schemas. A `transactionAmountSchema = z.number().refine(v => v > 0, "Amount must be > 0")` in `src/lib/server/schemas/` (or similar) imported by both POST and PATCH would close 5 bugs at once.
4. **Goal `currentSavedCents` cap on contribute.** R9-FLOWS-001 fix: in `src/app/api/goals/[id]/contributions/route.ts`, before incrementing, fetch the goal's `targetAmountCents`, compute `remaining = target - currentSaved`, and either reject (`400 "Contribution exceeds remaining"`) or clamp at `target` and return a flag. Pick whichever matches product intent.
5. **Receipt-OCR pre-check `Content-Length` before parsing.** R9-AI-001 fix: in `src/app/api/ai/receipt-ocr/route.ts`, read `request.headers.get('content-length')` first; if greater than `MAX_BYTES + slack`, return 413 immediately. Then `request.formData()` only handles within-limit bodies and the catch can keep its 415 default.
6. **DELETE Content-Type gate is wrong.** R9-FLOWS-002 fix: the proxy's CSRF guard (`src/proxy.ts:4-49` per ground truth) likely rejects non-JSON content-type on every write verb including DELETE. Carve out DELETE (no body) so the gate doesn't trip on body-less requests.
7. **Hydration mismatch on /transactions.** R9-PWA-001 — bisect by toggling each formatter / "x ago" relative-time on the ledger row. Likely candidate: `formatLocalYmd` in `src/components/app/transactions-ledger.tsx:41-48` if the server emits a UTC-resolved string and client picks up the user's local TZ on hydrate.
8. **/sw.js cache-control.** R9-PREFLIGHT-001 — set `cache-control: no-cache, must-revalidate` (or `max-age=0`) on `/sw.js` so the CDN doesn't hold the old SW for up to 4 hours after a deploy. Browsers will still respect their own `max-age=0` SW-update heuristic; the CDN is the issue.
9. **Insights leftover.** AI-BEDROCK left 1 unprefixed `MONTHLY_SUMMARY` row because there's no `DELETE /api/ai/insights/[id]` endpoint. Identical in shape to one a real user would generate by clicking the insights button — not a leak — but worth adding a delete path for symmetry, or at least documenting that insights are intentionally append-only.
10. **Multi-instance audit hooks** — if/when EC2 autoscales, both the rate-limit `Map` (`src/proxy.ts:9`) and the idempotency `Map` (`src/app/api/transactions/route.ts:14`) lose cross-instance coordination. Either move both to Redis/Upstash or accept per-instance behavior; document the choice.
