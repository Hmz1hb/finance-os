# Round 3 — appended 2026-04-25

## V1 — CRUD verifications

**Method:** Browser MCP was unavailable, so verification was done by (a) probing every relevant `/api/*` endpoint anonymously against `https://finance.elhilali.dev` to confirm it now exists (401 instead of 404 / 503) and accepts the expected method, and (b) reading the route handlers + page components + forms to confirm the documented logic is in place.

**Result:** All 15 CRUD-related items I was assigned remained `[x]` and were appended with `✓ Verified 2026-04-25` annotations inline. No items needed re-opening. Highlights:

- Every `[id]` route (`transactions`, `loans`, `receivables`, `recurring-rules`, `owner-pay`, `subscriptions`, `goals`, `categories`) ships GET + PATCH + DELETE.
- Every action route (`/loans/[id]/payments`, `/goals/[id]/contributions`, `/receivables/[id]/payments`, `/expected-income/[id]/settle`, `/payroll/pay-myself`) ships POST.
- All top-level POSTs (receivables, owner-pay, etc.) return **401**, not the previous 503 — auth + write paths are healthy.
- `settleExpectedIncome` throws `HttpError(409)` when status is already `SETTLED` (idempotency confirmed in `src/lib/server/cashflows.ts:86`).
- `pay-myself` schema clamps amount to `0 < x ≤ 1,000,000` and rejects negative/overflow with sanitized 400 (`src/app/api/payroll/pay-myself/route.ts:14-19`).
- Receivable payments enforce `paymentCents ≤ outstandingCents` with a 400 carrying the cents remaining (`src/app/api/receivables/[id]/payments/route.ts:28-30`).
- Loan payments require `principal + interest === amount` and decrease `remainingBalanceCents` inside a Prisma `$transaction`.
- Owner-pay DELETE soft-deletes both paired business + personal transactions inside a `$transaction` before deleting the OwnerCompensation row.
- Categories: POST hard-codes `isSystem: false`; PATCH/DELETE both throw 403 on system rows; the page hides RowActions when `category.isSystem`.

### V1 — newly-discovered bugs

- [x] **P1 — [TEST-AGENT-R3-V1] RowActions never receives an `onEdit` handler on any list page** ✓ R6-verified 2026-04-26 — kebab → `["Edit","Delete"]` on all 8 list pages: transactions, loans, goals, subscriptions, receivables, payroll, categories, recurring rules. Upcoming-expected projection rows correctly show only `["Delete"]` (not editable schedule entities). ✓ R5 fixed 2026-04-26 — completed the partial fix by adding owner-pay-row.tsx / recurring-rule-row.tsx / category-row.tsx; /payroll, /income-schedules (RecurringRule grid), /categories now wire onEdit → EditDialog → PATCH. All 8 list pages covered. ✗ R4 deploy-gap 2026-04-26 — live RowActions kebab on /transactions still shows Delete only; the 5 row components (transactions-ledger.tsx, goal-row.tsx, loan-row.tsx, receivable-row.tsx, subscription-row.tsx) and transaction-edit-form.tsx are all UNTRACKED in git, so no Edit affordance shipped. *(Partial fix 2026-04-25 — wired on /transactions, /loans, /goals, /subscriptions, /receivables (the 5 most-used list pages). Each page now hosts a thin client row component that opens an EditDialog with a pre-populated inline form PATCHing the resource. /payroll, /income-schedules (recurring rules), /categories still missing the Edit affordance — follow-up.)*
  - **Pages:** `/transactions`, `/loans`, `/receivables`, `/payroll`, `/income-schedules`, `/subscriptions`, `/goals`, `/categories`
  - **Repro:** `grep -n "onEdit" src/app/(app)/**/page.tsx` → 0 hits. `RowActions` only renders the Edit menuitem when `onEdit` is passed (`src/components/app/row-actions.tsx:90-102`), so the Edit option is invisible everywhere — only Delete is reachable.
  - **Expected:** Each list page wires `onEdit` to open an `EditDialog` pre-populated with the row, calling `PATCH /api/<resource>/[id]` on submit. The PATCH endpoints are already live for every entity, and `EditDialog` already exists at `src/components/app/edit-dialog.tsx`.
  - **Actual:** Edit affordance is missing across the entire app even though the original Round 1 ledger ticks (Income schedules, Receivables, Owner-pay, Loans, Subscriptions, Goals) imply it ships. Per-resource edit forms remain "follow-up". Promote to a tracked P1 so it's not lost in the noise.
  - **Severity rationale:** Delete works, so users aren't blocked, but they still have to delete + re-create to fix any typo — identical to the Round 1 complaint and risks data-quality regressions (lost FK-linked rows like attachments / payments).

- [x] **P2 — [TEST-AGENT-R3-V1] Income-schedules page lacks a "Settle / Mark received" button on Upcoming-expected rows** ✓ R6-verified 2026-04-26 — 2 × `<button>Mark received</button>` rendered on upcoming-expected rows on /income-schedules. ✗ R4 deploy-gap 2026-04-26 — expected-income-settle-button.tsx is untracked in git; not in deployed bundle. *(Fix 2026-04-25 — added <ExpectedIncomeSettleButton/> on each Upcoming row; POSTs /api/expected-income/[id]/settle and refreshes via router.refresh(); 409 ("already settled") surfaces as toast.info.)*
  - **Page:** `/income-schedules`
  - **Repro:** Look at any Upcoming row → only the `RowActions` kebab (Edit/Delete). The `POST /api/expected-income/[id]/settle` endpoint exists and is correct (idempotent with 409), but no UI control invokes it.
  - **Expected:** A "Mark received" button on each upcoming row that calls the settle endpoint and refreshes the page.
  - **Actual:** The endpoint is reachable only via curl / DevTools. Original Round 1 caveat acknowledged this — keeping at P2 because the endpoint itself is healthy.

## V2 — Validation + error-format verifications

22 endpoints exercised with malformed payloads. **All scoped Round 1 + Round 2 items verified clean** — every endpoint now returns 400 (or 404 / 409 / 413 / 503 where appropriate) with the unified `{ "error": "...", "issues": [{ "message", "path" }] }` envelope. No raw Zod issue trees, no Prisma stack traces, no internal types reach the client on validation failures.

**Verified clean (21 ledger lines ticked with ✓ above):**
- /business/tax + /reports — no raw JSON in HTML
- /income-schedules + /loans — Zod tree replaced with `{error, issues:[]}`
- /api/loans — full validation; bad enum / negatives / missing fields → 400
- /api/transactions — negative, future date, 12-digit overflow → 400 sanitized
- /api/import/csv — multipart garbage → 400 "missing required columns: amount, date"
- /api/recurring-rules — INTERVAL_DAYS no longer demands dayOfMonth/secondDayOfMonth/endDate
- /api/payroll/pay-myself — negative, overflow, missing fromEntityId/toEntityId all → 400
- /api/expected-income/[id]/settle — bogus ID → 404 `{"error":"Expected income not found"}`
- /api/receivables/[id]/payments — overpay → 400 with remaining balance; zero/negative → 400
- /api/exchange-rates — empty body → 400 with field issues
- /api/goals — missing fields + negative target → 400 with sanitized issues
- /api/subscriptions — bad enums + coerce.date string → 400 with sanitized issues
- /api/ai/receipt-ocr — empty form → 400 "Missing file"; >10MB → 413; bedrock down → 503 `{code:"AI_UNAVAILABLE"}`
- ?entity=does_not_exist → 200 with "Unknown entity" empty state (no silent default coerce)

**New / residual issues found by V2**

- [x] **P2 — [TEST-AGENT-R3-V2] JSON-bodied POST to multipart-only endpoints returns 500 "Unexpected server error"** ✓ R6-verified 2026-04-26 — `/api/import/csv` JSON → **415** `{"error":"Expected multipart/form-data"}`; `/api/ai/receipt-ocr` JSON → **415** same body. ✗ R4 deploy-gap 2026-04-26 — both `/api/import/csv` and `/api/ai/receipt-ocr` still 500 on JSON body. *(Fix 2026-04-25 — both routes now check Content-Type and throw HttpError(415, "Expected multipart/form-data") before touching formData)*
  - **Endpoints:** `/api/import/csv`, `/api/ai/receipt-ocr`
  - **Repro:** `fetch('/api/import/csv', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({csv:'...'}) })` → `500 {"error":"Unexpected server error"}`. Same for `/api/ai/receipt-ocr` with any JSON body.
  - **Expected:** 400 (or 415) with a clear "expected multipart/form-data" message — wrong content-type is a client error, not an unexpected server error.
  - **Severity:** Polish — multipart inputs are validated correctly (400 / 413 / 503); only the wrong-content-type path leaks the generic 500. Pollutes error budgets and looks like an outage to monitoring.

- [x] **P3 — [TEST-AGENT-R3-V2] Loan schema repro example in Round 1 ledger is stale** (informational only — fix is in) ✓ R10-fixed 2026-04-26 — `qa/rounds/01-original-audit.md:95` updated to reflect the now-required fields (`kind`, `lenderName`, `monthlyPayment`, `startDate`).
  - **Note:** Round 1 line 95 lists the bad payload as `{originalAmount, remainingBalance, interestRate, expectedPayoffDate}`. Today's schema requires `kind` (`OWED_BY_ME`/`OWED_TO_ME`/`CREDIT_CARD`/`BUSINESS_LOAN`/`BNPL`), `lenderName`, `monthlyPayment`, `startDate`. The error envelope is clean and validation works correctly — just flagging that the loan model has been re-shaped since Round 1 and the ledger's example payload is stale. Future audits should refer to the current Zod schema.

## N4 — SEO + print + SW bgsync

Audited prod at https://finance.elhilali.dev. Read-only (no test data created).

### Sitemap / robots / favicon
- `GET /sitemap.xml` -> **404** (`x-nextjs-prerender: 1`, so Next is actively serving the 404 — file is not generated). **P3** for a single-user app.
- `GET /robots.txt` -> **404**. The 404 page itself ships `<meta name="robots" content="noindex">`, but the canonical robots.txt does not exist. For an auth-walled single-user app the correct contents are `User-agent: *` / `Disallow: /`. **P2** — currently relying entirely on per-page `noindex`.
- `HEAD /favicon.ico` -> 200 `image/x-icon`. Multiple icon sizes wired up via `<link rel="icon">` (16, 192, 512) and `<link rel="apple-touch-icon">` (152, 167, 180). Apple splash images (1170x2532, 1290x2796, 2048x2732) all resolve 200. **OK**.

### Per-route metadata (`/dashboard`, `/transactions`, `/ai`, `/reports`-redirect-target)
- `<title>` is the **same string** "Finance OS" on every route audited. No per-route title overrides. **P3**.
- `<meta name="description">` is the **same string** on every route ("Personal and business finance management PWA for Moroccan freelancers and entrepreneurs."). **P3**.
- `<meta name="viewport">` -> present and correct. **OK**.
- `<meta name="theme-color">` -> `#1B1F2A`. **OK**.
- `<link rel="canonical">` -> **MISSING on every route**. **P3**.
- Open Graph (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`) -> **all MISSING**. Twitter card tags -> **all MISSING**. Pasting any URL into Slack/iMessage/Discord gets a bare-URL preview with no image and no proper title — **P2**.
- JSON-LD structured data -> **none**. Not needed for this app type — **OK**.
- Quirk: `/reports` 302-redirected to `/subscriptions` during the audit. Not a metadata bug, but `/reports` may not be a real destination route.

### manifest.webmanifest
- Served at `/manifest.webmanifest` with `content-type: application/manifest+json`. Valid JSON.
- Fields: `name`, `short_name`, `description`, `start_url: "/dashboard"`, `scope: "/"`, `display: "standalone"`, `orientation: "portrait"`, `background_color: "#1B1F2A"`, `theme_color: "#1B1F2A"`. **OK**.
- Icons: 192, 512 (any) + 192, 512 (maskable) — all resolve 200 with `image/png`. **OK**.
- Missing: `id` field (recommended for stable PWA identity), `categories`, `lang`, `dir`. **P3**.

### Print stylesheet
- Enumerated `document.styleSheets` on `/transactions`. CSS rules whose `MediaList` includes `print`: **0**. No `@media print {}` blocks anywhere.
- Did **not** trigger `window.print()` per scope rules.
- Verdict: **no print stylesheet exists**. Hitting Cmd-P on /transactions or /reports will print the live dark-mode UI including sidebar, toasts, and dialogs. **P2** for users who want paper records; **P3** otherwise.

### Service worker bgsync replay
- `navigator.serviceWorker.getRegistrations()` -> 1 registration, scope `/`, scriptURL `/sw.js`, state `activated`.
- Cache names actually present: `workbox-precache-v2-...` (106 entries), `start-url` (1), `finance-os-static-assets` (18), `finance-os-static-images` (6). **`finance-os-api` cache does NOT exist** — confirms R2's note that it's declared in the SW but never populated.
- IndexedDB dbs: only `workbox-expiration`. **No `workbox-background-sync` DB exists** (that's the canonical store for bgsync queues).
- SW source (`/sw.js`, 12 KB) inspection: zero occurrences of `BackgroundSync`, `bgsync`, `backgroundSync`, or `Queue`. All four `registerRoute(...)` calls are bound to `"GET"` only (NetworkFirst for `/`, NetworkFirst for `/api/*`, CacheFirst for images, CacheFirst for js/css/woff). **No fetch handler for POST/PUT/PATCH/DELETE**, no failure-replay queue plugin attached.
- **Verdict: bgsync is NOT implemented.** Going offline and submitting a transaction form will not queue the POST — it fails immediately. The only working offline behaviour is serving precache assets + the `/offline` shell. **P2** if "offline-capable PWA" is promised; **P3** if soft. The unused `finance-os-api` GET cache route is harmless dead code worth cleaning up.

### Summary table
| Check | Status | Severity |
|---|---|---|
| /sitemap.xml | 404 | P3 |
| /robots.txt | 404 | P2 |
| favicon + icon sizes | OK | — |
| manifest.webmanifest | OK (minor `id` field missing) | P3 |
| Per-route `<title>` | All identical | P3 |
| Per-route `<meta description>` | All identical | P3 |
| viewport / theme-color | OK | — |
| canonical link | Missing everywhere | P3 |
| Open Graph tags | Missing everywhere | **P2** (sharing previews) |
| Twitter card tags | Missing everywhere | P2 |
| JSON-LD | N/A | — |
| @media print rules | 0 in any stylesheet | **P2** |
| SW bgsync queue | Not implemented | **P2** if offline-capable is promised |

## N3 — Performance past 150 rows

**TL;DR:** R2 P3 worried `/transactions` would "hitch noticeably past ~500 rows." Inserting 500 rows revealed a **different** problem: the page is hard-clipped to 80 rows on the server (`take: 80` in `src/app/(app)/transactions/page.tsx:15`) and the list API is hard-clipped to 300 rows (`take: 300` in `src/app/api/transactions/route.ts:70`). Render perf is fine *because* the user can never see more than 80. Scaling concern is escalated, not refuted: rows past 80 are invisible from the UI, with no "Load more", pagination, or filter UI to reach them.

**Insert throughput (500 records, batches of 25 with 200–250ms inter-batch spacing):**
- Run 1 (lost return value due to tab-yank by parallel agents, but server-side rows confirmed): **191 inserts**, 0 failures, 0 × 429.
- Run 2 (308 of 308): `okCount=308, failCount=0, rateLimitHits=0, totalMs=12827`.
- Per-insert latency (run 2, n=308): **min 98ms, median 239ms, mean 275ms, p95 552ms, max 592ms**.
- Effective throughput (run 2 wall-clock): **24 inserts/sec sustained** (308 / 12.8s); ~42ms/insert amortised — *faster* than R2's solo 76ms/insert because Promise.all batches let Cloudflare/server pipeline. **No rate limiter triggered at this rhythm** — confirms R2's P1 rate-limit gap is still wide open at insert pressure ~25 rps from one origin.
- Total perf-prefixed records ground-truthed via `/api/transactions?limit=10000`: **201 visible** in the latest 300 rows (the 300-row list cap means the older ~300 of mine are not enumerable through this endpoint).

**Render metrics — `/transactions` cold-load with 500 rows in the DB:**
- `ttfb=220ms`, `domInteractive=262ms`, `domContentLoaded=262ms`, `loadEventEnd=337ms`.
- `transferSize=14.5 KB` (zstd), `encodedBody=14.3 KB`, `decodedBody=204 KB`, `htmlLen=230,963 bytes`.
- `domCount=1282`, `docHeight=5807px`, `rowDivCount=80` (matches hardcoded `take:80`).
- `cls=0`, `longTaskCount=0`, `longTaskTotalMs=0`. (LCP/FCP returned null on a backgrounded tab — paint timing not observable since other agents kept yanking focus, but DCL/load timings are reliable.)
- RSC payload not observable in this run (`rscCount=0`) — page is a pure RSC stream over the document response, no separate `_rsc` fetches on cold-load.
- For comparison: R2 measured `docHeight=5843px`, `778 DOM elements` at 75 rows. Going from 75 → 80 rendered rows took us from 778 → 1282 DOM nodes (+65%, ~6.3 nodes/row). At 500 actually-rendered rows DOM would be ~3950 nodes and `docHeight ≈ 36,300px` — but **none of this is reachable** with the current `take:80` cap.

**Scroll smoothness (80 rows, 5807px doc):**
- 30-step programmatic scroll across full doc height: `totalMs=0.8`, `avgStepMs=0.02`, `maxStepMs=0.1`, `slowSteps_gt16ms=0`, `slowSteps_gt33ms=0`. **No jank, no dropped frames.** With only 80 rows there's nothing to choke on.
- RAF-based test was inconclusive because Chrome backgrounded the tab (`document.visibilityState=hidden`) when other agents pulled focus — RAF doesn't tick in background. Synchronous step-scroll above is the reliable measurement.

**Search / filter UI status:**
- **Zero filter or search controls on the page.** All 7 `<input>` and 5 `<select>` elements belong to the "Quick add" `<TransactionForm>` (date / amount / counterparty / description / paymentMethod / taxDeductible / file + kind / context / entityId / currency / categoryId).
- No `input[type=search]`, no `[role=search]`, no Filter/Search button, no date-range picker, no entity filter, no amount filter, no description text-search.
- The only way to find a specific older transaction is to know its `id` and hit `/api/transactions/{id}` directly, or eyeball the latest 80.

**Pagination / virtualization status:**
- **None.** Confirmed by reading source: the ledger `<Card>` simply maps `transactions` (the `take:80` slice) into `<div>`s. No `react-window`, no `@tanstack/virtual`, no "Load more" button, no `[role=navigation]` with pagination semantics, no infinite-scroll IntersectionObserver. R2 P3's escalation stands — and is more severe than R2 thought, because the issue isn't render hitching, it's that **the data is not addressable from the UI at all past row 80**.

**New issues found by N3**

- [x] **P1 — [TEST-AGENT-R3-PERF] `/transactions` UI silently truncates at 80 rows with zero affordance to access older data** ✓ R6-verified 2026-04-26 — live /transactions: `<input placeholder="Search description...">` present, `<button>Load more</button>` present after the ledger; initial render = 50 rows (down from 80). ✗ R4 deploy-gap 2026-04-26 — live SSR HTML still renders 80 rows, 0 search inputs, 0 Load-more buttons. transactions-ledger.tsx is untracked. *(Fix 2026-04-25 — SSR initial render now takes 50 rows; <TransactionsLedger/> client component below it offers a debounced description search + cursor-paginated "Load more" against the new `{data, nextCursor}` API envelope.)*
  - **Repro:** Insert ≥81 transactions, hit `/transactions`. Only the 80 most-recent (by `date desc`) are rendered. There is no "Load more", no pagination, no date-range filter, no search box. Older transactions exist in the DB and are partly reachable via the list API but invisible in-product.
  - **Code:** `src/app/(app)/transactions/page.tsx:15` — `prisma.transaction.findMany({ ..., take: 80 })`.
  - **Severity:** P1 because for a personal-finance app, "I can't find a transaction from 3 months ago" is a fundamental product break. Bypassing the UI to fetch by id is not a real workaround.
  - **Fix sketch:** Add cursor pagination (`?before=<date>` or `?cursor=<id>`), a date-range filter (already exists at the data layer for `?entity=`, mirror that pattern), and a description text-search (`?q=`). Bonus: virtualize once page-size > ~200 to keep DOM small.

- [x] **P2 — [TEST-AGENT-R3-PERF] `GET /api/transactions` is hard-capped at 300 rows with no pagination params, no `Link`/`X-Total-Count` headers, no `nextCursor` field** *(Fix 2026-04-26 — `Number(null)` returns 0 which is finite, so `Number.isFinite(limitParam)` was true even when no `?limit=` was sent. Gated `usePagination` on `params.has("limit")` instead. New regression test at `tests/transactions-legacy-year.test.ts` confirms `?year=2026` returns a bare array and `?limit=10` returns the envelope.)* ✗ R6 — partial regression: cursor / limit / `q` envelope works correctly (`{data, nextCursor}` returned, cursor advances, `?q=text` honored), but the legacy `?year=2026` fallback that R5 promised to keep as a bare array now ALSO returns the new envelope. Anyone consuming `?year=` as `r.json().forEach(...)` breaks silently. Keep open as partial regression — see Round 6 partial-regression entry. ✗ R4 deploy-gap 2026-04-26 — live probe: bare-array response (no `{data,nextCursor}`); `?cursor`, `?limit`, `?q` all ignored. *(Fix 2026-04-25 — GET now accepts `?cursor=<id>`, `?limit=<n>` (capped at 100, default 50), `?q=<text>` and returns `{data, nextCursor}`. Legacy `?year=…` callers without pagination params still get the bare-array 300-row envelope so existing consumers don't break.)*
  - **Repro:** `fetch('/api/transactions?limit=10000').then(r=>r.json()).then(d=>d.length)` → `300`. `?limit=` is ignored. Response is a bare array — no `{data, nextCursor}` envelope, no `Link` header, no count header.
  - **Code:** `src/app/api/transactions/route.ts:70` — `take: 300` baked in.
  - **Severity:** P2 because once N3's P1 above is fixed, the page will need cursor support from this endpoint. Also affects any future export/CSV-download feature — there's currently no way to enumerate >300 transactions through the public API.
  - **Fix sketch:** Accept `?limit` (cap at e.g. 500) + `?cursor` (date+id), return `{data, nextCursor}`. Add a `?count=true` mode that returns just `{count}` for headers/counters.

- [x] **P2 — [TEST-AGENT-R3-PERF] R2's P1 rate-limiter gap re-confirmed at higher pressure** *(Fix 2026-04-25 — same root cause as L360 / L922; middleware bucket lowered 60→30 writes/60s; vitest `tests/middleware-rate-limit.test.ts` confirms the 31st write returns 429 with `retry-after`. Note: still in-memory per-instance — needs a shared store if EC2 ever scales beyond 1.)*
  - **Repro:** 308 sequential-batched POSTs at ~25 rps from one browser session: 0 × 429, 0 retries needed. R2 saw the same with 75 inserts; we saw it with 4× more. Whatever rate limiter R2 thought was added is either not on `POST /api/transactions` or has a ceiling well above 25 rps per session.
  - **Severity:** P2 (re-flag). Already on the ledger as a Round 2 P1; bumping it because we now have a sharper number: a hostile script can dump >=1500 rows/min into a user's ledger without backoff.

**Hard numbers (matching R2's precision):**
- 308 inserts in 12827ms → **42ms/insert** (24 inserts/sec sustained), 0 failures, 0 × 429.
- TTFB 220ms · DCL 262ms · loadEventEnd 337ms · htmlLen 230,963 bytes · transferSize 14.5 KB · 1282 DOM elements · docHeight 5807px · rowCount 80 · scroll max-step 0.1ms · 0 dropped frames.
- DB has ~500 perf-prefixed rows; UI shows 80; API returns max 300.

**Cleanup:** All 500 inserts use `[TEST-AGENT-R3-PERF]` prefix. Existing R1 cleanup SQL at the top of this ledger (`description LIKE '[TEST-AGENT-%]%'`) covers them. No untouched/un-prefixed rows were modified.

## N5 — Browser permissions + edge UX

Audited bundle + live-DOM probes against `https://finance.elhilali.dev`. **Bottom line: there is no permission UI to break — the app uses zero permission-gated browser APIs.** Bundle scan across all 11 chunks (~640 KB combined): 0 hits for `requestPermission`, `getUserMedia`, `navigator.clipboard.writeText`, `navigator.clipboard.readText`, `execCommand("copy")`, `WebSocket`, `EventSource`, `beforeunload`, `onbeforeunload`. The remaining matches for `Notification` / `clipboard` / `contextmenu` are all React/sonner/Radix internals (synthetic-event wiring, the Sonner toaster's `containerAriaLabel:"Notifications"`), not the corresponding browser APIs.

**Verified clean / non-issues**

- **Notification API** — never called. There are no in-app reminders for due recurring rules / receivable aging / subscription renewals — those would be the natural trigger but currently nothing is wired. Service Worker `/sw.js` (11 KB, offline cache only) has no `showNotification` / `pushManager` references either. Permission prompt cannot fire unsolicited.
- **Camera (receipt scan)** — `/transactions?scan=1` uses `<input type="file" accept="image/*,application/pdf" capture="environment">` (see `src/components/app/receipt-upload.tsx:25`). No `getUserMedia` is invoked. The native browser file-picker handles the camera prompt, so degradation is automatic — denying camera just shows the native file picker as fallback. No app-level permission rationale is shown before the prompt, but since the OS picker itself is unambiguous ("take photo / choose file"), this is acceptable.
- **Permissions-Policy header** is set: `camera=(self), microphone=(), geolocation=(), payment=()` — explicitly disables mic/geo/payment, restricts camera to same-origin. Good defence-in-depth.
- **Clipboard** — no copy buttons anywhere in the app (no IBAN, transaction reference, share-link, or AI-message copy affordance). `navigator.clipboard.*` is unused. Standard text selection works fine for amounts and references.
- **WebSocket / SSE** — none. AI chat uses fetch + ReadableStream (7 `getReader()` matches in bundle; `/api/ai/chat` returns chunked plaintext per `src/lib/server/bedrock.ts:streamAdvisorResponse`, not `text/event-stream`). No `/api/sse` or `/api/stream` endpoints exist. Network tab confirms 0 WS handshakes on any page.
- **Right-click / context-menu** — no app-level `oncontextmenu` suppression (anti-pattern absent). 5 bundle hits all trace to React's synthetic-event registry.
- **Money values are selectable** — `user-select: auto` on dashboard MetricCards / row amounts (`62.059,80 د.م.` etc.). Copy-paste of figures works via OS shortcut.
- **AI chat streaming UX** confirmed via Round 1 / N4 audits — graceful 503 fallback when Bedrock is unreachable.

**Findings**

- [x] **P3 — [TEST-AGENT-R3-N5] No `prefers-color-scheme` support — light theme exists but is unreachable** ✓ R6-verified 2026-04-26 — `<html data-theme>` is null on prod; ≥1 PRM rule in inline stylesheets, ≥2 PRM occurrences in fetched CSS bundle. ✗ R4 deploy-gap 2026-04-26 — `<html data-theme="dark">` still hardcoded in deployed HTML; deployed CSS bundle `a94d4a560df99c34.css` has 0 `prefers-color-scheme` rules. *(Fix 2026-04-25 — added `@media (prefers-color-scheme: light)` block to globals.css that maps `:root` to the existing light tokens; dropped the `data-theme="dark"` hardcode in layout.tsx so the media query can win.)*
  - **Repro:** `src/app/globals.css` defines a complete light palette under `:root[data-theme="light"]` (lines 35-43) and toggling the attribute manually via DevTools instantly recolors the UI to the light tokens (verified: `bg → rgb(245,247,251)`, `fg → rgb(16,21,31)`). However, `src/app/layout.tsx:65` hardcodes `data-theme="dark"`, no UI control toggles it, no `@media (prefers-color-scheme: light)` rule exists in any loaded stylesheet, and the Sonner Toaster is also pinned `theme="dark"` in `layout.tsx:75`.
  - **Expected:** Either (a) drop the dead light tokens entirely so the codebase doesn't lie about supporting both, or (b) wire a `prefers-color-scheme` media query + a manual toggle in `/settings`. Users on light-mode OS get a hard-coded dark UI with no opt-out.
  - **Severity:** Polish — site is usable as-is, but the half-built feature is wasted code.

- [x] **P3 — [TEST-AGENT-R3-N5] No `beforeunload` guard on dirty forms** ✓ R6-verified 2026-04-26 — pristine state: beforeunload event default not prevented; after typing into `#tx-amount`: `defaultPrevented === true`, `returnValue` set. Dirty-gated correctly. ✗ R4 deploy-gap 2026-04-26 — use-form-submit.ts modified locally but not pushed; live probe inconclusive. *(Fix 2026-04-25 — useFormSubmit now tracks a dirty flag set on first input/change inside any registered form-control and registers a beforeunload listener that calls preventDefault + sets returnValue; cleared on successful submit and cleaned up on unmount.)*
  - **Repro:** `window.onbeforeunload === null` on every page; bundle has 0 `beforeunload` references; `useFormSubmit` never registers one. Editing 6 input fields in a Transaction form and clicking the sidebar away discards the entry silently.
  - **Expected:** Either a `beforeunload` warning when a form is dirty (standard browser confirm dialog) or an in-app "discard changes?" intercept on the sidebar router push. Right now the only safety net is muscle memory — easy to lose 30 seconds of typing on a fat-finger nav.
  - **Severity:** Minor UX — most fields auto-fill from defaults so the loss is small; only matters on long manual entries (CSV-style bulk corrections, OCR review).

- [ ] **P3 — [TEST-AGENT-R3-N5] Missed opportunity: scheduled events never trigger Notification API**
  - **Note:** App tracks recurring-rule due dates, expected-income settlements, receivable aging, subscription renewals — all natural candidates for opt-in browser notifications. Today there's nothing — Service Worker is cache-only, no `Notification.requestPermission()` is ever requested. Not a bug; flagging as a product gap for the roadmap.
  - **Severity:** Product gap, not a regression.

## N1 — Auth flows

Probed the auth surface end-to-end. Stack is NextAuth v5 (`authjs.*` cookie names) with a single `Credentials` provider backed by `ADMIN_USER` / `ADMIN_PASSWORD` env vars (bcrypt-hashed). Session strategy is JWT (no DB session table). Findings below.

### N1 — P1

- [x] **P1 — [TEST-AGENT-R3-N1] No logout UI anywhere in the app** ✓ R6-verified 2026-04-26 — 2 × `<button>Sign out</button>` rendered on /dashboard (SidebarNav + MobileNav). ✗ R4 deploy-gap 2026-04-26 — live DOM has 0 sign-out controls; sign-out-button.tsx is untracked in git. *(Fix 2026-04-25 — new SignOutButton client component wired into the bottom of SidebarNav (separator + full-width button) and as a 6th cell on MobileNav; both call signOut({ callbackUrl: "/login" }) from next-auth/react.)*
  - **Page:** every authenticated route (dashboard, settings, all entity pages)
  - **Repro:** Fetched `/dashboard /settings /ai /personal /business /categories /payroll /loans /transactions` server HTML — zero matches for `logout`, `log out`, `sign out`, `signout`, or `/api/auth/signout`. `grep -ri "signOut\|logout" src/` → zero matches.
  - **Expected:** A "Sign out" control in the app shell (settings page or user menu) calling `signOut()` from `next-auth/react`.
  - **Actual:** The only way to end the session is to manually visit `/api/auth/signout` (the default NextAuth confirmation page) or clear cookies in DevTools. A user on a shared/borrowed device cannot log out.

- [x] **P1 — [TEST-AGENT-R3-N1] No rate limit on `/api/auth/callback/credentials` (login bruteforce open)** *(Fix 2026-04-26 — same Next 16 `middleware` → `proxy` rename root cause as L297 / L360; the credentials-callback bucket exists in source but the file was never compiled. Now in `src/proxy.ts`. Pending live verification post-deploy.)* ✗ R6 — live still broken post-R5-deploy: 27 bogus-cred POSTs all returned `opaqueredirect` (3xx to `/login?error=…`), 0 × 429. R5's special-case in middleware.ts for the credentials callback either still skips on `isApiAuth` or matches without firing. Same root-cause family as L297 / L360 — see Round 6 TL;DR. ✗ R4 deploy-gap 2026-04-26 — 11 sequential attempts all 3xx, no 429. middleware.ts modified locally but not pushed. *(Fix 2026-04-25 — middleware now special-cases the credentials callback before the isApiAuth skip; per-IP bucket of 10 attempts / 15 min returns 429; covered by tests/middleware-rate-limit.test.ts)*
  - **Page:** `POST /api/auth/callback/credentials`
  - **Repro:** 25 parallel POSTs with bogus creds → 25× 200 in 1825ms (no 429). `middleware.ts` rate-limits `isWrite && isLoggedIn` only — login is unauthenticated by definition, so the bucket is never consumed. The path is also under `/api/auth/`, which the middleware short-circuits as `isApiAuth` and skips entirely (lines 42-43, 45).
  - **Expected:** Per-IP throttle on the credentials callback (e.g. 10 attempts / 15 min) returning 429.
  - **Actual:** Unlimited attempts. With bcrypt cost 10 (~80ms/check), one host can both DoS the auth path and slow-bruteforce any future weaker password.

### N1 — P2

- [x] **P2 — [TEST-AGENT-R3-N1] Login error message names internal env vars: "Invalid credentials or missing ADMIN_USER / ADMIN_PASSWORD."** ✓ R6-verified 2026-04-26 — `ADMIN_USER` / `ADMIN_PASSWORD` absent from /login HTML and from all 4 login JS chunks (`page-f2dd248ffc4057f5.js`, `4194-…js`, `942-…js`, `8928-…js`). ✗ R4 deploy-gap 2026-04-26 — old string verbatim in deployed JS chunk `/_next/static/chunks/app/(auth)/login/page-310f41a9d7870e1b.js`. *(Fix 2026-04-25 — error string in login-form.tsx replaced with generic "Invalid username or password.")*
  - **Page:** `/login` (text emitted by `src/components/app/login-form.tsx:28`)
  - **Repro:** Submit any wrong username/password → red error text reveals the env-var names used for auth.
  - **Expected:** Generic "Invalid username or password." Implementation detail (env-var names) should not reach the browser.
  - **Actual:** Leaks that the app is single-user with hard-coded env credentials — useful recon for an attacker (tells them there is no user table to enumerate or reset, only the env vars to target).

- [ ] **P2 — [TEST-AGENT-R3-N1] JWT session cannot be revoked; concurrent sessions are uncoordinated**
  - **Page:** `auth.ts` (`session: { strategy: "jwt" }`, no DB adapter)
  - **Repro:** Session is a signed JWT with NextAuth's 30-day default `maxAge` (verified: `/api/auth/session` returns `expires=2026-05-25T...`, exactly 30 days from today, and the value rolls forward on each request). Logging in from a second device issues a *new* JWT but does not invalidate the first; visiting `/api/auth/signout` only clears the cookie *on the current browser*. There is no server-side session store, so a leaked/stolen cookie remains valid for up to 30 days.
  - **Expected:** Either (a) DB-backed sessions so signout deletes the row and other tabs are killed, or (b) a `tokenVersion` claim bumped on logout/password-change so old JWTs fail validation.
  - **Actual:** Single-user app today, low blast radius — but if/when a second user is added (per the deferred multi-tenancy P0 from R2), this becomes a real account-takeover risk.

### N1 — P3 (informational / coverage)

- [ ] **P3 — [TEST-AGENT-R3-N1] Auth route map**
  - **Pages that exist (HTTP 200):** `/login`, `/api/auth/session`, `/api/auth/csrf`, `/api/auth/providers`, `/api/auth/signin` (NextAuth chooser, redirects to `/login`), `/api/auth/signout` (NextAuth default confirmation page), `/api/auth/callback/credentials`.
  - **Pages that 404:** `/auth/login`, `/auth/register`, `/auth/forgot`, `/auth/reset`, `/auth/logout`, `/auth/signout`, `/register`, `/signup`, `/signin`, `/forgot-password`, `/reset-password`, `/logout`, `/signout`. `/api/auth/{login,register,logout}` 400 (NextAuth catch-all rejects unknown actions).
  - **Missing-by-design (single-user via env):** registration, password reset, "forgot password", account creation. These are intentionally absent because credentials live in env vars.
  - **Missing-by-oversight:** "Remember me" checkbox — cookie always uses NextAuth's 30-day default `maxAge`; user has no way to choose a shorter session on a public computer.

- [ ] **P3 — [TEST-AGENT-R3-N1] Cookie attributes verified from `auth.ts` + observed behaviour**
  - Session cookie name: `__Secure-authjs.session-token` (in production, due to `isProduction` branch in `auth.ts:28`).
  - CSRF cookie name: `__Host-authjs.csrf-token` (`auth.ts:37`).
  - Both: `httpOnly: true`, `sameSite: "lax"`, `secure: true`, `path: "/"`. Confirmed `document.cookie` returns empty string in a logged-in tab (HttpOnly working).
  - `Max-Age` not exposed via "remember me" — that checkbox does not exist.

- [ ] **P3 — [TEST-AGENT-R3-N1] Verified non-bugs (so we don't re-flag)**
  - Bad creds → generic error ✓ (no user-enumeration via timing or distinct messages — bcrypt always runs because env vars are set in prod).
  - Empty fields → same generic error ✓ (HTML5 `required` plus zod `min(1)` server-side).
  - 10,000-char username/password → handled gracefully, returns the same generic error, no 500 ✓.
  - Logged-in user GET `/login` → 302 redirect to `/dashboard` (`middleware.ts:89-91`) ✓.
  - Anonymous user GET any non-auth route → 302 redirect to `/login?callbackUrl=...` (`middleware.ts:83-87`) ✓ — confirms Round 2's correction of Round 1's "no auth gate" finding.
  - `?callbackUrl=` is sanitised by NextAuth (cannot be used as open redirect to external host) ✓.

- [ ] **P3 — [TEST-AGENT-R3-N1] Coverage notes (what was NOT tested and why)**
  - Did not test a full *successful* login from a fresh cookie-less tab: would require clearing the production session cookie at the domain level, which would briefly log Hamza out of his other tabs. The login *failure* path is fully covered, and the success path is exercised continuously by Hamza's live session.
  - Did not actually invoke `/api/auth/signout` end-to-end for the same reason — would terminate Hamza's working session. Confirmed via code (`auth.ts`) and `GET /api/auth/signout` returning the default confirmation page that the wiring is the stock NextAuth flow with no custom cookie-clear logic.
  - No registration to clean up — registration endpoint does not exist, so the "Cleanup needed" section gets nothing from this agent.

## N2 — Accessibility on remaining pages

Audited the pages R2-A skipped (`/categories`, `/goals`, `/receivables`, `/payroll`, `/business`, `/business/income`, `/business/expenses`, `/business/tax`, `/personal`, `/personal/expenses`, `/personal/emergency-fund`, `/settings`, `/reports`) on `https://finance.elhilali.dev`. Method: live DOM probes + WCAG 2.1 AA contrast math (formula identical to R2's). One `[TEST-AGENT-R3-N2]` receivable was created and deleted to exercise the row-actions menu and the delete-confirm dialog; ledger ended at zero net rows.

**Verified clean / non-issues across all 13 pages**

- **Skip link** — first focusable element on every page is `<a>Skip to main content</a>`, reaching `#main`. Confirmed via `document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')[0].textContent` → `"Skip to main content"` everywhere.
- **Tab order** — exactly **20 focusables before `<main>`** on every authenticated page (1 skip link + sidebar nav anchors + entity switcher + theme button). Stable, predictable.
- **Heading hierarchy** — every page has exactly **one `<h1>`**, no h3-before-h2 violations. /business/tax has 1×h1 + 5×h2 (the densest), all linear. Other pages are 1×h1 + 1–3×h2.
- **Form input labels** — **0 unlabeled inputs** in `<main>` on every authenticated page. Every `<input>/<select>/<textarea>` has either an explicit `<label for="…">` (verified: `rec-title`/`Title`, `rec-amount`/`Amount`, the dynamic `recpay-date-{cuid}`/`Date`, `recpay-amount-{cuid}`/`Amount`, etc.) or sits inside a wrapping label.
- **Decorative SVG** — every `<svg>` inside `<main>` carries `aria-hidden="true"` or `role="presentation"`. 0 undecorated icons across all pages tested (totals: 3 SVG/page typical, 5 on /business/tax).
- **Live regions** — every page mounts a `<section aria-live="polite">` toast container; the row "Close toast" button confirms it's the Sonner outlet. Aria-live is "polite" everywhere — appropriate (no `assertive` abuse).
- **Modal focus (Delete-confirm dialog)** — opened on /receivables. Has `role="dialog"`, `aria-modal="true"`, `aria-labelledby="confirm-dialog-title"`, focus moves into the dialog (lands on the destructive "Delete" button), and **`Escape` closes the dialog** (verified: dispatched `keydown` Escape → dialog removed from DOM). 3 focusables inside (Close-X, Cancel, Delete).
- **Heading text** — all descriptive ("Categories", "Financial goals", "Tax reserve cockpit", "Owner pay", "Emergency fund", "Reports & analytics", etc.). No "Click here" / "Read more" anti-patterns.
- **prefers-reduced-motion** — already verified globally by R2 and not regressed: no animated component in scope (no marquees, no auto-playing carousels).
- **Row actions menu** — opens with `role="menu"` (verified on the receivables row's "Row actions" button → kebab popover containing the Delete menuitem).

**Findings**

- [x] **P1 — [TEST-AGENT-R3-N2] Primary "Add …" submit buttons fail WCAG AA contrast (3.34 : 1, needs 4.5)** ✓ R6-verified 2026-04-26 — every primary CTA on /categories, /goals, /receivables, /payroll, /subscriptions: white on rgb(33,102,184) = **5.74:1** (AA pass). /login Sign-in inferred from same `--blue-ledger: #2166b8` token + matching primary-button stylesheet. ✗ R4 deploy-gap 2026-04-26 — live probes on /transactions, /receivables, /loans all show bg `rgb(74,144,217)` = 3.343:1 (still failing). globals.css darkening is uncommitted. *(Fix 2026-04-25 — `--blue-ledger` token in globals.css darkened from #4a90d9 to #2166b8 (white-on-blue now 5.74:1); fixes every primary CTA + skip link bg + selection highlight. See L939 for the link-on-dark-surface trade-off this introduces.)*
  - **Pages:** /categories ("Add category"), /goals ("Add goal"), /receivables ("Add receivable"), /payroll ("Record owner pay"), /subscriptions ("Add subscription"), /login ("Sign in"). Same brand-blue token reproduced verbatim across 6 distinct pages — fixing it once fixes them all.
  - **Computed values:** `color: rgb(255, 255, 255)` on `background-color: rgb(74, 144, 217)` at `font-size: 16px, font-weight: 400`. Manual ratio: **3.34 : 1**. Not large text (16 px regular ⇒ AA threshold = 4.5 : 1).
  - **Same root cause family as R2's existing P1 contrast bug** but on a different surface — R2 flagged the muted secondary-text token; this is the **primary action button background**. Tracking separately because the fix is independent (button bg, not text fg).
  - **Severity:** P1 — primary CTAs are the most-clicked UI element. Failing AA on every "Add" / "Save" / "Sign in" button is a reliable accessibility-audit fail.
  - **Fix sketch:** Darken the brand blue. `rgb(33, 102, 184)` (≈ `#2166B8`) on white text gives 5.04 : 1 (AA pass) and stays close to the current hue. Alternatively keep `rgb(74,144,217)` and bump to `font-weight: 600` + `font-size: 18.66px` to clear the large-text exemption (3.0 : 1 threshold).

- [x] **P2 — [TEST-AGENT-R3-N2] /login form inputs are unlabeled — placeholder-only** ✓ R6-verified 2026-04-26 — anonymous fetch + DOMParser confirms `<label htmlFor="login-username">Username</label>` and `<label htmlFor="login-password">Password</label>` paired with matching `id` on Input components in the deployed login chunk. ✗ R4 deploy-gap 2026-04-26 — source verified PASS (login-form.tsx has htmlFor/id pairing); deploy pending. *(Fix 2026-04-25 — added id="login-username" / id="login-password" plus visible <label htmlFor> for both inputs)*
  - **Page:** /login.
  - **Repro:** `Array.from(document.querySelectorAll('main input')).filter(i => !i.hasAttribute('aria-label') && !document.querySelector('label[for="'+i.id+'"]'))` → returns `[<input name="username" placeholder="Username">, <input name="password" placeholder="Password">]`. Both have empty `id` (so no label can be associated by `for`), no `aria-label`, no `aria-labelledby`. Placeholder text disappears on focus — screen-readers announce only "edit text" / "edit password".
  - **Expected:** Either visible `<label for="login-username">Username</label>` paired with the input (preferred for everyone, including sighted users on auto-fill mismatches), or at minimum an `aria-label="Username"` / `aria-label="Password"` on the input itself.
  - **Severity:** P2 — login is the front-door of the app and the only place a public unauthenticated user ever lands. Outside the authenticated app every other form is labelled correctly, so this is a single-page miss.

- [x] **P3 — [TEST-AGENT-R3-N2] Focus-trap in the Delete-confirm dialog: not provable via automation** ✓ R10-closed-by-code-read 2026-04-26 — `src/components/app/confirm-dialog.tsx:28–63` implements a custom Tab-wrap on top of the Radix `Dialog`: initial focus on `confirmRef`, manual forward + backward Tab cycling that prevents focus escape, `previousActive?.focus()` restore on close, `body.overflow = "hidden"` background scroll lock. Implementation is sound; no synthetic event needed.
  - **Page:** any list page with row delete (verified on /receivables).
  - **Repro:** Dialog has `role="dialog"`, `aria-modal="true"`, focus enters correctly, Escape closes — but couldn't verify Tab cycling via synthetic `KeyboardEvent` (browser doesn't actually shift focus on dispatched Tab). Manual keyboard test recommended; if Radix's focus-scope is wired the trap works, but worth a one-line sanity check by the developer.
  - **Severity:** P3 — most likely fine (Radix `Dialog` traps focus by default), flagging as "untested by automation" rather than "broken".

**Hard numbers**
- 13 pages probed · **0 unlabeled inputs** in any authenticated `<main>` · **2 unlabeled inputs** on the public `/login` page (username + password) · **6 contrast failures all caused by one token** (`rgb(255,255,255)` on `rgb(74,144,217)` = 3.34 : 1) · **0 heading-hierarchy violations** · **1 modal verified** (delete-confirm) with role+aria-modal+labelledby+escape correct.
- Test data: 1 `[TEST-AGENT-R3-N2]` receivable created and deleted in the same audit. Net DB delta = 0.

## V3 — Data-accuracy verifications

Cross-page math + currency display verified on the live deployment with real probes. 3 test records created and cleaned up: `[TEST-AGENT-R3-V3] Probe Loan` (100 GBP), `[TEST-AGENT-R3-V3] Probe expense` (50 GBP), `[TEST-AGENT-R3-V3] Probe Sub` (15.99 GBP MONTHLY). All three deleted via DELETE /api/{loans,transactions,subscriptions}/[id] -> 204 (no leftover pollution).

**Scoped items verified clean (ticked above):**
- R1 P0 line 105 — Net Worth ignores loans -> Liabilities went 0 -> 100 after [TEST-AGENT-R3-V3] loan create
- R1 P0 line 110 — Cockpit "Expected 30d" 2x EntityRail "Expected" -> both 23.162,06 د.م. on /dashboard
- R1 P0 line 115 — /personal "Debt remaining" 7x /loans "Total debt" -> both 100,00 د.م. with [TEST-AGENT-R3-V3] loan
- R1 P0 line 119 — Dashboard "Cash now" tile ignores expenses -> after 50 GBP expense Combined dropped 130.075,04 -> 129.449,62 (= 625,42 د.م. = 50 x 12.508418); Cash now also dropped — both surfaces respect expenses
- R1 P1 line 163 — Subscription currency mismatch -> row shows £15.99, monthly burn shows MAD as expected
- R2 P1 line 403 — Settings "Refresh via API" navigates to JSON -> now a button, click stays on /settings
- R2 P1 line 408 — Cockpit Expected 30d inconsistent with EntityRail -> match (overlap with R1 P0 line 110)
- R2 P2 line 458 — Hand-rolled US format vs Intl fr-MA -> period thousands + comma decimal everywhere (129.449,62 د.م.)
- R2 P2 line 463 — health-score `incomeDiversification` hardcoded to 60 -> POST /api/health-score returns `incomeDiversification: 0` from real data

**Scoped items still broken:**
- R1 P1 line 159 — UK LTD entity labelled GBP but values render with `د.م.` -> STILL BROKEN. `?entity=uk_ltd` dashboard pill says "GBP" + a separate "GBP" label above the cockpit, but Cash now `117.243,02 د.م.`, Expected 30d `23.162,06 د.م.`, etc. all carry the MAD symbol. Underlying values are MAD-equivalent — they are just wearing a GBP label.

**New data-accuracy bugs found by V3**

- [x] **P1 — [TEST-AGENT-R3-V3] /loans "Total debt" + /personal "Debt remaining" + /net-worth Liabilities all render GBP loan amounts with the MAD `د.م.` symbol (no currency conversion)** ✓ R6-verified 2026-04-26 — 100 GBP `[TEST-AGENT-R6-VDATA-fx]` loan: /loans Total debt `1.250,84 د.م.`, Monthly obligation `125,08 د.م.`; /personal Debt remaining `1.250,84 د.م.`; /net-worth Liabilities `1.250,84 د.م.`, Net worth `-1.250,84 د.م.`. 100 GBP × 12.508418 = 1250.8418 — FX conversion applied correctly across all three pages. ✗ R4 deploy-gap 2026-04-26 — live probe: 100 GBP loan still aggregates as `100,00 د.م.` on all 3 pages (expected ~`1.250,84 د.م.`). Source fix exists, not deployed. *(Fix 2026-04-25 — /loans, /personal, and net-worth.ts now FX-convert each loan via getMadRate(loan.currency) before summing; cents across currencies are no longer added as raw cents. Same fix applies to /loans Monthly obligation.)*
  - **Pages:** `/loans`, `/personal`, `/net-worth`
  - **Repro:** Create a 100 GBP loan (`POST /api/loans`). The loan card itself correctly shows `£100.00`. But the aggregate cards render:
    - /loans -> "Total debt" = `100,00 د.م.` (should be ~`1.250,84 د.م.` after FX)
    - /loans -> "Monthly obligation" = `10,00 د.م.` (should be ~`125,08 د.م.`)
    - /personal -> "Debt remaining" = `100,00 د.م.`
    - /net-worth -> "Liabilities" = `100,00 د.م.` and "Net worth" = `-100,00 د.م.`
  - **Expected:** `aggregate += loan.remainingBalanceCents * fx[loan.currency -> MAD]`. The aggregator currently sums raw `remainingBalanceCents` cross-currency and slaps `د.م.` on it. The 100 GBP x 12.508418 should produce `1.250,84 د.م.` everywhere these aggregates appear.
  - **Severity:** P1 — every cross-page debt aggregate underreports debt by ~12x when loans are in GBP. The cross-page numbers MATCH each other (so the "7x discrepancy" of R1 line 115 is genuinely fixed: the upstream source-of-truth is now consistent), but they all share the same FX-conversion bug. Likely affects USD/EUR loans the same way.
  - **Reproduced cleanly with [TEST-AGENT-R3-V3] Probe Loan (id `cmoenvd3400001mojg5ussu99`, since deleted).**

- [x] **P3 — [TEST-AGENT-R3-V3] EntityRail Combined and Cockpit Cash now diverge by a small fixed amount on baseline** ✓ R5 fixed 2026-04-26 — root cause was `entityRailSummary`'s `cashBalanceCents({ entityId })` having no `date <= now` filter while `cockpitSummary` already filtered (cockpit.ts:82). The gap was exactly the sum of future-dated transactions for the entity. Patch: pass `date: { lte: now }` at the EntityRail call site (cockpit.ts:44).
  - **Pages:** `/dashboard`
  - **Repro:** Pre-existing data on the live deployment shows EntityRail Combined `130.075,04 د.م.` while Cockpit "Cash now" shows `130.065,04 د.م.` — a 10 د.م. gap that persisted before/after the V3 50 GBP expense probe. Both surfaces respond correctly to new expenses (so R1 P0 line 119 is genuinely fixed), but they still aren't reading from a single source of truth for the absolute baseline number.
  - **Expected:** Combined and Cash now should agree exactly when there are no in-flight pending or overdue items.
  - **Severity:** P3 informational — the deltas track new transactions correctly; only the absolute values disagree by a small constant. Worth investigating to confirm both queries use the same filter set.

## V4 — Form/idempotency/security verifications

**Method:** 1 fresh agent (V4) drove `https://finance.elhilali.dev` via Chrome MCP — same authed session, all probe records prefixed `[TEST-AGENT-R3-V4]`. Scope was the 18 ledger items covering form-submit hardening (L132, L156, L170), security headers / rate limit / CSRF / attachments (L297, L302, L360, L364), accessibility (L350, L415, L420, L424, L429, L450, L452, L454), and the L435 / L446 / L456 polish items.

**Result:** 16/18 verified clean. 2 re-opened: **CSRF text/plain (L297)** and **rate limiting (L360)**. Inline `✓ Verified` / `✗ Re-opened` annotations added on each line above. Detailed evidence:

### V4 — re-opened bugs

- [x] **P0 — [TEST-AGENT-R3-V4] CSRF: `Content-Type: text/plain` still accepted on `/api/transactions`** (originally line 297; flipped back to `[ ]` above) *(Fix 2026-04-25 — confirmed middleware enforces 415 locally; vitest tests/middleware-csrf.test.ts asserts text/plain POST to /api/transactions returns 415)*
  - **Repro:** `fetch('/api/transactions', { method:'POST', headers:{'Content-Type':'text/plain'}, body: JSON.stringify({entityId:'morocco_personal', context:'PERSONAL', kind:'EXPENSE', amount:0.11, currency:'MAD', date:'2026-04-25', description:'…'}) })` → **200**, record persisted (id `cmoenwzdb006h1mojyeyqif9c`). Same with no `Content-Type` header at all → **200**. Earlier 400 responses I saw were Zod rejecting wrong field names (`amountCents` vs `amount`, missing `context`), not the content-type guard.
  - **Expected:** Reject `text/plain` (and any non-`application/json`) on write methods with 415 / 400 — exactly what the Phase 7 fix description claimed.
  - **Caveat:** Same-origin browser JS cannot fake the `Origin:` header (browser enforces it), so an Origin/Referer server-side check could *also* be in place and prevent real cross-origin attacks. But the explicit content-type guard described as the fix is not active. Worth re-checking from a separate origin (e.g. an SSH'd curl from the EC2 box) to confirm whether Origin enforcement covers the gap. If it does, this could be downgraded to "documentation drift". If not, it's a real CSRF foothold.

- [x] **P1 — [TEST-AGENT-R3-V4] No effective rate limiting on `/api/transactions`** (originally line 360; flipped back to `[ ]` above) *(Fix 2026-04-25 — RATE_LIMIT_MAX_WRITES lowered 60→30; vitest tests/middleware-rate-limit.test.ts asserts the 31st write returns 429 with retry-after)*
  - **Repro:** `Promise.all` of 50 `POST /api/transactions` → **50× 200**. Followed immediately by another batch of 30 → **30× 200**. **80 writes from the same authed session in ~2 minutes, zero 429s.** No `Retry-After`, no per-IP / per-session bucket triggering anywhere on this endpoint. The Phase 7 description ("60 writes/minute per session/IP") is either not wired in front of `/api/transactions` or the bucket is too generous / per-request scoped.
  - **Expected:** After ~60 writes inside a 60-second window, subsequent requests should return 429 with a `Retry-After`.
  - **Note:** In-memory token buckets also break the moment EC2 scales beyond one instance — consider a shared store (Redis / Cloudflare rate-limit rule).

### V4 — newly-discovered residual bugs

- [x] **P2 — [TEST-AGENT-R3-V4] Receipt-scan `<input type="file">` on `/transactions` has no associated label** ✓ R6-verified 2026-04-26 — live DOM: `id="receipt-file"`, `aria-label="Upload receipt image"`, `<label for="receipt-file">Receipt image</label>` — all three present. ✗ R4 deploy-gap 2026-04-26 — source verified PASS (receipt-upload.tsx has htmlFor/id + aria-label); deploy pending. *(Fix 2026-04-25 — receipt-upload.tsx now wraps the file input with a visible "Receipt image" label (htmlFor/id paired) and an explicit `aria-label="Upload receipt image"` on the input.)*
  - **Repro:** `document.querySelector('main input[type="file"]')` returns the receipt-scan input on `/transactions`; it has no `aria-label`, no `aria-labelledby`, no surrounding `<label>`, and no `id` paired with `<label for>`. Screen readers announce only "file upload, button" with no purpose.
  - **Expected:** Either wrap in `<label>Scan receipt <input type="file" /></label>` or add `aria-label="Upload receipt image"`.
  - **Context:** Round 2 line 350 was ticked because *forms across the app* now have labels (loans is fully clean, taxDeductible is wrapped). This single residual file input is the last hold-out on `/transactions` — it's the only `main`-scope unlabeled input the audit could find.

- [x] **P2 — [TEST-AGENT-R3-V4] `/transactions` form does not attach `Idempotency-Key` to its POST** ✓ R6-verified 2026-04-26 — captured fetch header on Quick-add submit: `Idempotency-Key: 0b7c6a17-d56f-4730-ad6b-284e19943965` (valid UUID v4). ✗ R4 deploy-gap 2026-04-26 — server-side dedupe still works when header sent manually, but use-form-submit.ts UUID generation is uncommitted; deploy pending. *(Fix 2026-04-25 — useFormSubmit now generates a per-render UUID via crypto.randomUUID (with a Date.now+Math.random fallback), attaches it as the `Idempotency-Key` request header on every POST/PATCH/PUT/DELETE, and rotates it after a successful submit. Synchronous double-click now hits the server with the same key and dedupes to 1 row.)*
  - **Repro:** Sniffed `window.fetch` while submitting the Quick-add form — captured `{method:"POST", url:"/api/transactions", idem:null, ct:"application/json"}`. Server-side dedupe works perfectly when the header is set (verified on L446) but the form itself never sets one. Synchronous `btn.click(); btn.click()` (no event-loop yield between clicks) bypasses the disabled-state guard and creates two rows ms apart (`cmoeo07sp00ko… / cmoeo07ss00kp…`, 3 ms apart).
  - **Expected:** Have `useFormSubmit` (or the `/transactions` form) generate a UUID per render and include `Idempotency-Key` on the POST. The server already supports it.
  - **Context:** A real human double-click (~100ms apart, verified) only fires one POST because React has time to flip `disabled=true` between native click events. The synchronous-click case is mostly an automated-tooling concern, but the Idempotency-Key would also defend against retried POSTs from the SW background-sync layer if/when that ships.

- [x] **P2 — [TEST-AGENT-R3-V4] "Manage schedules" link still 4.40:1 contrast (residual from L429)** ✓ R6-verified 2026-04-26 — "Manage schedules" anchor: rgb(111,169,229) on rgb(34,40,55) = **5.95:1**; "Scheduled" badge on /transactions: 6.95:1. Both AA pass. New `--blue-ledger-fg: #6fa9e5` token confirmed live. ✗ R4 deploy-gap 2026-04-26 — live anchor still `rgb(74,144,217)` = 4.40:1. `--blue-ledger-fg` token uncommitted. *(Fix 2026-04-25 — added a separate `--blue-ledger-fg` token (`#6fa9e5` on dark, `#2166b8` on light) and switched 6 foreground-on-dark callsites to it: dashboard "Manage schedules" + invalid-entity link, transactions-ledger Scheduled badge, loan-payment-form + goal-contribute-form trigger links, entity-rail icon swatch, login-form lock chip. Background `bg-blue-ledger`, focus rings, accents, and borders still use the darker `#2166b8` from L850 since they pair with white text.)*
  - **Repro:** `getComputedStyle` on the dashboard "Manage schedules" anchor returns `color: rgb(74,144,217)` on `background: rgb(34,40,55)` at 12px — **4.40:1**, just under WCAG AA's 4.5:1 minimum for body text. The Phase 8 caveat already called this out; flagging here so it doesn't get lost.
  - **Expected:** Bump the link colour by ~5% lightness (e.g. `#6FA9E5`) or move to 14px/600 weight to qualify under AA-large rules.

### V4 — verified clean

| Bug | Result |
|---|---|
| L132 — Tx submit double-click | ✓ `disabled` flag flips between realistic clicks; 1 row from a 100ms-spaced double-click |
| L156 — AI chat client guards | ✓ `maxlength=4000`, `0/4000` counter, send button starts disabled |
| L170 — Loans UI refresh | ✓ form-created `[TEST-AGENT-R3-V4-loan-form]` appears without manual reload |
| L302 — Attachment filtering | ✓ .exe → 400, .html → 400, missing → 400, 11MB → 413 |
| L350 — Form labels | ✓ /loans 0 unlabeled; /transactions only outlier is the file input (logged P2 above) |
| L364 — Security headers | ✓ CSP, HSTS, XFO=DENY, nosniff, Referrer-Policy, Permissions-Policy on both HTML and API |
| L415 — Chat dialog role | ✓ `role="dialog"` + `aria-modal="true"`; focus moves to "Close advisor" |
| L420 — Chat Escape | ✓ Escape keydown closes the dialog (1→0 in DOM) |
| L424 — Skip link | ✓ first focusable on `/dashboard` is the visually-hidden skip link |
| L429 — Contrast | ✓ red text now 7.56:1 (AA-pass); residual 4.40 on "Manage schedules" |
| L435 — /offline retry | ✓ `<button>Retry</button>` rendered |
| L446 — Idempotency-Key dedupe | ✓ same key → same id (`cmoenwveo002z1moj5mk3vrmz`) |
| L450 — Single h1 | ✓ exactly 1 h1 ("Combined cash cockpit") |
| L452 — prefers-reduced-motion | ✓ 2 PRM rules detected in stylesheets |
| L454 — Bottom-nav SVGs | ✓ 24/24 carry `aria-hidden="true"` |
| L456 — Attachment 400/413 | ✓ empty → 400, oversized → 413 |

### V4 — cleanup

- [x] Delete `[TEST-AGENT-R3-V4]` records — caused by deliberate floods + form / idempotency / CSRF / attachment probes: *(R3 cleanup 2026-04-25 — all transactions + 2 loans deleted via DELETE /api/...)*
  - **Transactions:** ~85 (50 from rate-limit flood #1 + 30 from rate-limit flood #2 + 1 idempotency-dedupe (single id, but only 1 surviving row), 1 CSRF text/plain, 1 CSRF no-content-type, 1 CSRF fake-Origin, 2 dblclick rows, 1 dbl2 row, 1 dbl3 row). All amounts ≤ 0.13 MAD, all PERSONAL/EXPENSE — visually obvious in any ledger view.
  - **Loans:** 2 (`[TEST-AGENT-R3-V4-loan-api]` id `cmoeo2dzp00kt1moj50e3q11e`, `[TEST-AGENT-R3-V4-loan-form]` — both 100 MAD original / remaining).
  - **Attachments:** 0 successful uploads (all 4 .exe / .html / missing / oversized attempts were rejected — no S3 cleanup needed).
  - **Idempotency-Key cache rows:** 1 (whatever store backs the dedupe, key `TEST-AGENT-R3-V4-IDEM-…`). Best-effort to leave; will expire on its own.
  - **Recommended SQL** (re-using R2 patterns):
    ```sql
    UPDATE "Transaction" SET "deletedAt"=NOW() WHERE description LIKE '[TEST-AGENT-R3-V4]%';
    UPDATE "Loan"        SET "deletedAt"=NOW() WHERE "lenderName" LIKE '[TEST-AGENT-R3-V4-loan%';
    ```

---

## Round 3 — cleanup complete 2026-04-25

QA cleanup agent swept every `[TEST-AGENT-*]` record across Round 1, Round 2 and Round 3 audits via the production API on `https://finance.elhilali.dev` (DELETE `/api/<entity>/<id>`, authed session, no DB-level deletes).

| Entity | Matched | Deleted | Errors |
|---|---|---|---|
| transactions | 489 (R1+R2+R3 incl. R3-PERF flood, R3-V4 floods, R3-V4 idempotency/CSRF/dblclick rows) | 489 | 0 |
| loans | 2 (`[TEST-AGENT-R3-V4-loan-api]`, `[TEST-AGENT-R3-V4-loan-form]`) | 2 | 0 |
| subscriptions | 0 | 0 | 0 |
| goals | 0 | 0 | 0 |
| receivables | 0 | 0 | 0 |
| owner-pay | 0 | 0 | 0 |
| recurring-rules | 0 (3 listed, all "Azlotv LLC" production records — left untouched) | 0 | 0 |
| categories | 0 | 0 | 0 |
| attachments / income-schedules | endpoints 404 — no API path; no DB rows to delete | n/a | n/a |

S3 keys removed (the 2 R2 leftover orphan objects from `[TEST-AGENT-E-R2-*]`):
- `s3://finance-os-receipts-810500878308-eucentral1/receipts/2026/04/unlinked/bf646d68-91ff-4fa2-aef0-c1763be83b1f--TEST-AGENT-E-R2-ATT-.html`
- `s3://finance-os-receipts-810500878308-eucentral1/receipts/2026/04/unlinked/dd46ce82-e997-4ee2-9829-a2d79a777adb--TEST-AGENT-E-R2-ATT-.exe`

Sweep of `s3://.../receipts/` for any `TEST-AGENT` substring keys: 0 remaining.

Final API sweep: 0 `[TEST-AGENT-*]` records left across all entities. Production records owned by Hamza (14 transactions, 3 recurring-rules) untouched.

---
