# Round 6 — appended 2026-04-26

5 fresh agents drove `https://finance.elhilali.dev` via Chrome MCP for **wire-level live verification** of the 19 ledger items R5 pushed (deploy `a734dd4` completed at 11:38Z) but left to confirm in production. R5's discipline note ("a code-read is not a live verification") drove this round's scope.

## TL;DR — 16 of 19 R5 fixes verified live; 3 security-middleware items still wide open

The R4 deploy gap is closed (every `Fix 2026-04-25` annotation that was source-only is now in `origin/main` and the GitHub Actions Deploy ran clean). Most fixes hold up at the wire. Three security items are an exception: `middleware.ts` source enforces them, the local vitest passes, but the live request never traverses the guard. **Same root cause family** for all three (CSRF text/plain, write-path rate limit, login-bruteforce rate limit) — almost certainly a Next.js middleware-matcher / build-output gap, not three separate bugs. One partial regression on the legacy `?year=` API contract. Three new bugs in surfaces R1–R5 hadn't reached.

## Round 6 — re-flipped to `[ ]` (R5 source fix exists, but live request bypasses it)

- [x] **P0 — [TEST-AGENT-R6-VSEC] L297 CSRF text/plain still creates records on prod** *(Fix 2026-04-26 — see L297 above; root cause was Next 16's deprecation of `middleware.ts` in favour of `proxy.ts`. File renamed and moved to `src/proxy.ts` (correct location for src layout). Build now compiles the proxy into `.next/server/middleware.js` — verified by grepping for the guard message strings. Pending live verification post-deploy.)* ✗ R6 — live still broken: `POST /api/transactions` with `Content-Type: text/plain` → **200** (id `cmofppzx700001mntqeazwq0p`, 120ms); same with `Content-Type` header omitted entirely → **200** (id `cmofppzzu...`, 91ms). R5 added `tests/middleware-csrf.test.ts` and the test passes locally, but the live request never hits the guard. **Probable causes:**
  1. `export const config = { matcher: [...] }` in `middleware.ts` does not include `/api/transactions` (or the patterns don't actually match) — Next.js silently no-ops middleware on unmatched paths.
  2. The deployed bundle's `.next/server/middleware-manifest.json` lacks the new matcher (e.g. EC2 SSM script ran an old `pm2 restart` on a stale .next dir, or rsync didn't replace it).
  3. The standalone server (`server.js`) skips middleware for non-page routes by default in some Next configs.
  - **Diagnostic next steps for round 7:** `aws ssm send-command` an `ls -la /opt/finance-os/.next/server` and `cat /opt/finance-os/.next/server/middleware-manifest.json` to confirm the matcher is present in the live bundle. Also `curl -I https://finance.elhilali.dev/api/transactions -X POST -H 'Content-Type: text/plain'` and inspect any `x-middleware-rewrite` / `x-middleware-prefetch` response headers.

- [x] **P1 — [TEST-AGENT-R6-VSEC] L360 Rate limit not gating writes on prod** *(Fix 2026-04-26 — see L297 / L360. Same Next 16 `middleware` → `proxy` root cause; resolved by the file rename + relocation to `src/proxy.ts`. Pending live verification.)* ✗ R6 — live still broken: 35 sequential `POST /api/transactions` all returned 200, followed by 10 more (n=36..45) also all 200. Zero 429s, zero `Retry-After` headers across the 45 writes in <5s. R5 lowered `RATE_LIMIT_MAX_WRITES` from 60→30 and the vitest passes, but the live bucket is not consulted. Same root-cause family as L297 — see diagnostic plan above.

- [x] **P1 — [TEST-AGENT-R6-VSEC] L784 Login bruteforce limit not gating live** *(Fix 2026-04-26 — see L297 / L360 / L784. Same Next 16 `middleware` → `proxy` root cause; the credentials-callback rate-limit special-case was correct in source but never compiled. Now in `src/proxy.ts`. Pending live verification.)* ✗ R6 — live still broken: 27 `POST /api/auth/callback/credentials` with bogus creds, all returned `opaqueredirect` (3xx to `/login?error=…`), zero 429. R5's `middleware.ts` claims to special-case the credentials callback before the `isApiAuth` skip, but the live path either still skips middleware on `/api/auth/*` (the original R3 N1 reason) or matches but doesn't trigger. Same root-cause family as L297 / L360.

## Round 6 — partial regression

- [x] **P3 — [TEST-AGENT-R6-VDATA] L724 Legacy `?year=` query now returns the new envelope** *(Fix 2026-04-26 — `Number(null) === 0` and `Number.isFinite(0) === true`, so the `usePagination` flag in `src/app/api/transactions/route.ts` flipped to true on every request including pure `?year=` callers. Now gated on `params.has("limit")`. Regression test at `tests/transactions-legacy-year.test.ts` covers both branches.)* ✗ R6 — `GET /api/transactions?year=2026` returns `{data:[…], nextCursor:…}`, NOT the bare array R5's commit message promised to preserve. New cursor / limit / `?q=text` probes all PASS (envelope correct, cursor advances, q honored). The breakage is silent for any consumer expecting `r.json().forEach(...)` on `?year=` (e.g. an Excel-export script, a future CSV download endpoint). **Fix sketch:** keep the legacy bare-array shape when none of `?cursor / ?limit / ?q` are present; only flip to the envelope when a paging parameter is supplied. Or just bump every caller to the envelope and remove the legacy contract.

## Round 6 — verified live (R5 fixes confirmed)

| Ledger line | What was claimed | R6 wire-level evidence |
|---|---|---|
| L159 — UK LTD £ symbol | Cockpit converts back to entity baseCurrency | `?entity=uk_ltd` cockpit: `Cash now £3,273.58`, `Expected 30d £1,851.72`. 0 `د.م.` glyphs in cockpit body. Control: `?entity=morocco_personal` still shows MAD only. |
| L587 — Edit affordance on all 8 list pages | Row kebabs expose Edit + Delete everywhere | Kebab → `["Edit","Delete"]` on transactions, loans, goals, subscriptions, receivables, payroll, categories, recurring rules. Upcoming-expected projection rows correctly show only Delete (not editable schedule entities). |
| L594 — Settle / Mark received button | Each upcoming-expected row gets a "Mark received" button | 2 × `<button>Mark received</button>` rendered on /income-schedules. |
| L622 — Multipart-only endpoints reject JSON with 415 | content-type guard before formData() | `/api/import/csv` JSON → **415** `{"error":"Expected multipart/form-data"}`; `/api/ai/receipt-ocr` JSON → **415** same body. |
| L718 — /transactions UI cursor pagination + search | Search input + Load more button | `<input placeholder="Search description...">` present; `<button>Load more</button>` present; initial render = 51 ledger candidates (50-row default + 1 form). |
| L758 — `prefers-color-scheme` support | Drop hardcoded `data-theme="dark"`, add @media block | `<html data-theme>` is null; ≥1 `prefers-color-scheme` rule in inline stylesheets and ≥2 in fetched CSS bundle. |
| L763 — beforeunload guard on dirty forms | Dirty-flag tracker + window listener | Pristine state: `beforeunload` event default not prevented. After typing into `#tx-amount`: `defaultPrevented === true`, `returnValue` set. Gated correctly. |
| L778 — Sign-out UI in app shell | SidebarNav + MobileNav buttons | 2 `<button>Sign out</button>` on /dashboard. |
| L792 — /login no env-var leak | "Invalid username or password." replaces the leaky string | `ADMIN_USER` / `ADMIN_PASSWORD` absent from /login HTML and from all 4 login JS chunks (`page-f2dd248ffc4057f5.js`, `4194-…js`, `942-…js`, `8928-…js`). |
| L850 — Primary CTA contrast | `--blue-ledger: #2166b8` darkening | 5.74:1 (white on rgb(33,102,184)) on every Add-* button across /categories, /goals, /receivables, /payroll, /subscriptions; /login Sign-in inferred from same token. AA pass. |
| L857 — /login inputs labelled | `<label htmlFor>` + matching `id` | Chunk source: `<label htmlFor="login-username">Username</label>`, same for password. Probed via DOMParser on anonymous fetch. |
| L892 — FX-converted aggregates | `getMadRate(loan.currency)` before sum | 100 GBP `[TEST-AGENT-R6-VDATA-fx]` loan: `/loans` Total debt `1.250,84 د.م.`, Monthly obligation `125,08 د.م.`; `/personal` Debt remaining `1.250,84 د.م.`; `/net-worth` Liabilities `1.250,84 د.م.`, Net worth `-1.250,84 د.م.`. Pre-fix would have shown `100,00 د.م.` (raw cents added across currencies). |
| L929 — Receipt-scan file input has label | Wrap input + visible `<label>` + aria-label | `id="receipt-file"`, `aria-label="Upload receipt image"`, `<label for="receipt-file">Receipt image</label>` — all three present. |
| L934 — Idempotency-Key on /transactions form POST | useFormSubmit generates UUID per render | Captured fetch header on Quick-add submit: `Idempotency-Key: 0b7c6a17-d56f-4730-ad6b-284e19943965` (valid UUID v4). |
| L939 — `--blue-ledger-fg` link contrast | Separate token #6fa9e5 for foreground-on-dark | "Manage schedules" anchor: 5.95:1; "Scheduled" badge on /transactions: 6.95:1. Both AA pass. |

## Round 6 — newly-discovered bugs

- [x] **P2 — [TEST-AGENT-R6-NCOV-DST] /transactions date column slices the timestamp in UTC, not in the user's TZ** *(Fix 2026-04-26 — replaced `transaction.date.slice(0, 10)` in `src/components/app/transactions-ledger.tsx` with `formatLocalYmd(iso)` which uses `Intl.DateTimeFormat("en-CA", {...})`. The browser's resolved `timeZone` is the default, so dates render in the user's local zone. Africa/Casablanca midnight-local entries now show the correct day. Other 25 callsites of the same pattern are `<input type="date">` defaults — kept as-is since the user can override.)*
  - **Page:** `/transactions`
  - **Repro:** Insert a transaction with `date: "2026-03-28T23:00:00.000Z"` (which is **midnight `Africa/Casablanca`**, the user's TZ per `Intl.DateTimeFormat`). The row renders as **"2026-03-28"** in the ledger, but its Casa-local calendar day is `2026-03-29`.
  - **Expected:** Format with `formatInTimeZone(date, userTz, 'yyyy-MM-dd')` (or equivalent) so the day chip matches the user's wall clock.
  - **Actual:** Code path is using `.toISOString().slice(0,10)` (or equivalent UTC slice). Anything entered near local midnight will display 1 day off, and any DST-day filter / monthly bucket will mis-bucket it. Casablanca is permanently UTC+1 with no DST since 2018 (ramadan exceptions aside) so the gap is fixed at 1 hour year-round — small enough to miss, big enough to confuse end-of-month reconciliation.
  - **Severity:** P2 — affects any record entered after 23:00 Casablanca time; makes it impossible to do day-bucketed accounting near month-end.

- [x] **P2 — [TEST-AGENT-R6-NCOV-LOGIN] /login `<form>` has no `method` or `action` attributes — credentials would leak via GET if JS fails** *(Fix 2026-04-26 — added `method="post" action="/login"` to the form element in `src/components/app/login-form.tsx`. The `onSubmit` handler still calls `event.preventDefault()` so the JS path is unchanged; the explicit attributes only kick in if JS never executes, in which case the POST goes to our own `/login` page (credentials in body, not URL — never appears in browser history, `Referer:` headers, or proxy access logs).)*
  - **Page:** `/login`
  - **Repro:** Anonymous `fetch('/login', {credentials:'omit'})` returns a React form whose `<form>` element has neither `method=` nor `action=` attribute. Browser default for a form without `method` is `method="GET"`, with `action` defaulting to the current URL.
  - **Expected:** Either `<form method="post" action="/api/auth/callback/credentials">` as a no-JS fallback, or a `<noscript>` warning, or a server-side render that always includes `method="post"`.
  - **Actual:** If the login JS chunk fails to load or execute (CSP error, slow network, ad blocker, hostile proxy), submitting the form sends `username` and `password` as URL query parameters via GET. They'll show up in browser history, Cloudflare access logs, EC2 ALB / nginx logs, and any subsequent `Referer:` header to a third-party page the user visits.
  - **Severity:** P2 — JS-disabled / failed-load is rare but reproducible. Credential leak via logs is a real audit-fail trigger even if the live odds are tiny.

- [x] **P3 — [TEST-AGENT-R6-NCOV-DUP-RULE] "Azlotv LLC" recurring rule appears duplicated** ✓ Resolved by R8 — partial unique index `RecurringRule(entityId, title, cadence) WHERE deletedAt IS NULL` shipped via `prisma/migrations/002_recurring_rule_unique`; orphan deleted in prod. See `08-r7-live-verification.md`.
  - **Endpoint:** `GET /api/recurring-rules`
  - **Repro:** Of 3 active rules, two have identical `title`, `cadence` (SEMI_MONTHLY), and `nextDueDate` (2026-04-25). One has 0 ExpectedIncome rows linked, the other has 1.
  - **Expected:** A single rule per entity+title+cadence combination; duplicates suggest either a UI bug that allowed the same rule to be created twice, or a migration that double-inserted.
  - **Actual:** Likely Hamza's actual prod data — flagging for him to dedup manually via `DELETE /api/recurring-rules/<id>` on whichever copy has 0 children. Not a code bug per se, but the lack of a uniqueness constraint at the DB level is what permitted it.

## Round 6 — verified non-bugs (so we don't re-flag)

- Service worker has 3 active caches at runtime (not 4); the declared `finance-os-api` cache is registered but never instantiated until first matching API hit. R3 N4 already noted this — confirms behaviour, no regression.
- Recurring generator: anonymous `POST /api/recurring/generate` → 401 (correct); authed → 200 with `{created: []}`. R5's table-fix holds. The "empty" return is correct because all 3 active rules have `autoCreate=false`.
- Mobile DOM: `<nav aria-label="Mobile primary">` present on /dashboard, /transactions, /loans with `lg:hidden` + `safe-bottom fixed inset-x-0 bottom-0`. 6 cells (5 nav links + Sign-out), 6 SVG icons. Viewport meta correct (`viewport-fit=cover`). No horizontal overflow at desktop width.
- DST round-trip: 3 noon-UTC transactions on `2026-03-29`, `2025-10-26`, `2026-04-26` all round-tripped exactly through POST → list → GET-by-id (`T12:00:00.000Z` preserved). Only the boundary case (midnight-local) trips the new P2 above.
- `/api/auth/session` returns 30-day TTL, `/api/auth/csrf` returns 64-char hex, `/api/auth/providers` returns only `credentials` — confirms R3 N1 cookie-attribute audit.
- L622 multipart 415 PASSes — only verified-clean security item this round.
- All R5 a11y/UX fixes (L850, L939, L758, L763) hold — clean a11y sweep.
- All R5 form-UX fixes (L778, L792, L857, L929, L934, L587, L594) hold — clean form-UX sweep.
- All R5 data-accuracy fixes (L159, L892, L718) hold — clean data sweep except the partial L724 regression.

## Round 6 — cleanup

| Agent | Created | Deleted | Leftover |
|---|---|---|---|
| V-Sec | 47 (2 CSRF probes + 35 rate-limit flood + 10 follow-up) | 47 via `DELETE /api/transactions/<id>` | 0 |
| V-Forms | 6 (1 transaction + 1 goal + 1 subscription + 1 receivable + 1 owner-pay + 1 category) | 6 via `DELETE /api/<resource>/<id>` | 0 |
| V-Data | 1 loan (`[TEST-AGENT-R6-VDATA-fx]`, 100 GBP) | 1 via `DELETE /api/loans/<id>` (204) | 0 |
| V-A11y | 0 (read-only) | — | 0 |
| N-Coverage | 4 transactions (DST boundary probes) | 4 via `DELETE /api/transactions/<id>` (204) | 0 |
| **Total** | **58** | **58** | **0** |

Final sweep across `/api/transactions?limit=500` for `[TEST-AGENT-R6-` → 0 matches. Same for /loans, /goals, /subscriptions, /receivables, /owner-pay, /categories. No un-prefixed records modified. Hamza's data untouched.

## Round 6 — coverage map

| Surface | R6 result |
|---|---|
| Live wire-level CSRF guard | **FAIL** — middleware in source, not in request path |
| Live write-path rate limit | **FAIL** — same |
| Live login-bruteforce limit | **FAIL** — same |
| Multipart 415 guards | PASS |
| Idempotency-Key wire-up | PASS |
| Edit affordances (8 pages) | PASS |
| Mark received / Settle button | PASS |
| FX aggregation cross-page | PASS |
| /transactions cursor pagination UI | PASS |
| /api/transactions cursor envelope | PASS (cursor / limit / q) |
| /api/transactions `?year=` legacy | **FAIL** (regressed to envelope) |
| UK LTD GBP symbol | PASS |
| Sign-out UI in shell | PASS |
| /login env-var leak | PASS |
| /login input labels | PASS |
| Receipt-scan file input label | PASS |
| Primary CTA contrast (5 pages) | PASS (5.74:1) |
| `--blue-ledger-fg` link contrast | PASS (5.95–6.95:1) |
| `prefers-color-scheme` support | PASS |
| beforeunload dirty-form guard | PASS |
| Service worker / offline shell | PASS (no regression) |
| DST round-trip on noon-UTC dates | PASS |
| DST midnight-local boundary | **NEW BUG** (UTC-slice off-by-one) |
| /login no-JS form behaviour | **NEW BUG** (no method/action attrs) |
| Recurring rule dedup constraint | **NEW BUG** (duplicate "Azlotv LLC") |
| `/api/recurring/generate` after R5 fix | PASS |
| NextAuth cookie / session config | PASS |
| Mobile DOM (no actual viewport resize) | PASS |

## Round 6 — note for next round

The three FAIL items (L297, L360, L784) all have the same fingerprint: source is correct, local vitest passes, live request is 200/3xx instead of 415/429. Before round 7 spends agent budget re-probing, run **one** diagnostic SSH session against EC2 `i-0c1f380bdbc9a09c8`:

```bash
# Confirm the deployed bundle has the fixed middleware
aws ssm start-session --target i-0c1f380bdbc9a09c8 --profile newaccount
# inside the EC2 session:
sudo cat /opt/finance-os/.next/server/middleware-manifest.json | jq '.middleware'
# look for: matcher includes /api/transactions and /api/auth/callback/credentials
sudo grep -l 'Expected multipart' /opt/finance-os/.next/server/**/*.js
sudo systemctl status finance-os  # confirm pm2/systemd actually picked up the new build
```

If the manifest does include the matcher and the binary contains the fix string, the bug is in middleware *runtime* (e.g. matcher regex not actually matching, or a global error swallowing the 415/429 response). If the manifest is stale, the deploy script (`.github/workflows/deploy.yml` → SSM inline script) is dropping the new `.next` somewhere it isn't read.

R5's checklist items L297/L360/L784 should stay `[ ]` until both ends — local test AND live wire — pass.

