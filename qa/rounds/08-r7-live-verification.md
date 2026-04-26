# Round 8 — appended 2026-04-26

## TL;DR — every R7 source fix verified live; DEDUP closed by partial-unique migration + orphan delete

R7 shipped six source fixes (security trio + DST + login attrs + legacy `?year=`) and tagged them "code-verified only, pending live verification post-deploy". Round 8 ran the wire-level probes against the deployed bundle (`3ef5b89` → `24956804389`, success 12:37Z). Every fix holds. Then closed `L1187` (the duplicate "Azlotv LLC" rule R6 flagged) by adding a partial unique index on `RecurringRule(entityId, title, cadence) WHERE deletedAt IS NULL` and deleting the 0-children orphan. The constraint is SQL-only because Prisma's DSL can't express partial uniqueness — the migration is the source of truth, runtime violations surface as P2002.

The R6 post-mortem ("a code-read is not a live verification") drove this round's discipline: every `[x]` carries wire-level evidence, not a re-read of the source.

## Round 8 — verified live (R7 fixes confirmed at the wire)

| Ledger line | What R7 claimed | R8 wire-level evidence |
|---|---|---|
| L297 / L1137 — CSRF text/plain | proxy returns 415 on non-JSON write | `POST /api/transactions` with `Content-Type: text/plain` → **HTTP/2 415** body `{"error":"Content-Type must be application/json"}`. CSP + STS headers as expected. |
| L360 / L1143 — write rate-limit | 30 writes/60s/user, then 429 | 31 sequential `POST /api/transactions` (each with fresh Idempotency-Key) → 30× **200**, 31st = **429** with `retry-after: 55`. Elapsed 5s. All 30 created rows tagged `[TEST-AGENT-R8-VSEC]`, swept clean afterwards. |
| L784 / L1145 — login bruteforce | 10 attempts/15min/IP, then 429 | 11 anon `POST /api/auth/callback/credentials` with bogus creds → first 7× **302** to `/login?error=CredentialsSignin&code=credentials`, then 4× **429** with `retry-after: ~630`. Bucket already had 3 attempts from earlier auth tests on the same IP, so the 8th probe hit the cap (3 + 7 = 10) — math checks out. |
| L724 / L1149 — legacy `?year=` | bare array, not envelope | `GET /api/transactions?year=2026` → `Array.isArray(json) === true`, length 14. Control: `?limit=10` → `{data, nextCursor}`. Both branches as designed. |
| L1173 — `/transactions` DST | local-TZ formatting, not UTC slice | Inserted `2026-04-26T23:00:00Z` row, server stored `date=2026-04-26T23:00:00.000Z`. `Intl.DateTimeFormat("en-CA")` with `TZ=Africa/Casablanca` (matching the user's resolved zone) renders **2026-04-27** vs the buggy UTC slice's `2026-04-26`. Row deleted on cleanup. |
| L1180 — `/login` form attrs | `method="post" action="/login"` | Deployed JS chunk `/_next/static/chunks/app/(auth)/login/page-79d930323050329c.js` contains `"form",{onSubmit:g,method:"post",action:"/login",className:"space-y-4",...}`. Zero `ADMIN_USER`/`ADMIN_PASSWORD` strings in the chunk (L792 holds). |

## Round 8 — closed

- [x] **P3 — [TEST-AGENT-R6-NCOV-DUP-RULE] "Azlotv LLC" recurring rule appears duplicated** ✓ R8-verified 2026-04-26 — post-deploy `aws ssm` into EC2 + `psql -c "\d \"RecurringRule\""` shows index `RecurringRule_entityId_title_cadence_active_uq UNIQUE, btree ("entityId", title, cadence) WHERE "deletedAt" IS NULL` live; `_prisma_migrations` table records `002_recurring_rule_unique` finished `2026-04-26 13:42:42 UTC`. Constraint trip-test: `POST /api/recurring-rules` with the same `{entityId:"uk_ltd", title:"Azlotv LLC", cadence:"SEMI_MONTHLY"}` payload as the kept rule → **HTTP 500 `{"error":"Unexpected server error"}`** (Prisma P2002 falls through the generic `jsonError` branch — see "follow-ups" below for the polish opportunity), and `GET /api/recurring-rules` confirms still 2 active rules. *(Fix 2026-04-26 — added a partial unique index via `prisma/migrations/002_recurring_rule_unique/migration.sql`. SQL-only because Prisma DSL can't express partial uniqueness; the migration is the source of truth. Prod data cleanup: deleted the 0-children SEMI_MONTHLY orphan `cmoe2swug00011np6dmyyq62z`, keeping `cmoe3m2mz000i1moa4y9tpsnd` (1 child) and the distinct INTERVAL_DAYS rule `cmoe3jfz6000g1moa3gett8tc` (1 child).)*

## Round 8 — caveats / coverage notes

- **L1180 SSR caveat** — `/login` SSR'd HTML emits `<template data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING">` instead of a `<form>` element, because `LoginForm` calls `useSearchParams()` and the surrounding `<Suspense>` (login/page.tsx:14) has no fallback. Net effect: the no-JS scenario R6 worried about (default-GET form leaking creds) doesn't exist today — the form simply isn't server-rendered, so there's nothing for a no-JS browser to submit. R7's `method="post" action="/login"` attrs only apply post-hydration. Defensively correct, currently load-bearing only after JS. If a future change removes `useSearchParams` from `LoginForm` (e.g. lifting `callbackUrl` handling into the page server component), SSR will start emitting the form and the attrs become non-trivially load-bearing. Not a regression — flagging so a future round doesn't re-flag this.
- **DEDUP migration runs on container start** — `Dockerfile:32` is `CMD ["sh","-c","npx prisma migrate deploy && npx next start -p 3000"]`, so the constraint applies automatically on next deploy. No SSM step required.

## Round 8 — out of scope (deferred, unchanged from R7)

L307, L180, L199 / L202 / L205, L467, L470, L475, L628, L768, L806, L812, L818, L826, L863, L798, L1018, L1044 — same deferral rationale as R7.

## Round 8 — cleanup

| Probe | Created | Deleted | Leftover |
|---|---|---|---|
| Probe 2 — write rate-limit flood | 30 transactions tagged `[TEST-AGENT-R8-VSEC]` | 30 via `DELETE /api/transactions/<id>` (HTTP 204) | 0 |
| Probe 3 — login bruteforce | 0 (bogus creds) | n/a | 0 |
| Probe 5 — DST midnight-local | 1 transaction tagged `[TEST-AGENT-R8-DST]` | 1 via `DELETE /api/transactions/<id>` (HTTP 204) | 0 |
| Azlotv duplicate cleanup | 0 (Hamza's data, not test data) | 1 via `DELETE /api/recurring-rules/<id>` (HTTP 204) | 0 |
| **Total** | **31 prefixed** | **32 (incl. Azlotv)** | **0** |

Final sweep `GET /api/transactions?q=%5BTEST-AGENT-R8-` → 0 matches across both prefixes. `GET /api/recurring-rules` shows 2 active rules, both intentional.

## Round 8 — coverage map

| Surface | R8 result |
|---|---|
| Live wire-level CSRF guard | **PASS** (415) |
| Live write-path rate limit | **PASS** (30 then 429, Retry-After 55) |
| Live login-bruteforce limit | **PASS** (cap at 10/IP/15min, Retry-After 630) |
| `?year=` legacy bare-array | **PASS** |
| `?limit=` envelope (control) | **PASS** |
| DST midnight-local formatter | **PASS** (Casa local 2026-04-27 vs UTC 2026-04-26) |
| `/login` form `method`/`action` (post-hydration) | **PASS** |
| `/login` env-var leak in JS chunks | **PASS** (zero matches) |
| RecurringRule DB-level dedup constraint | **NEW — partial unique index shipping in migration 002** |
| Prod Azlotv duplicate | **CLEANED** (0-children orphan deleted) |

## Round 8 — follow-ups for R9 (not bugs, polish opportunities)

1. **Polish: P2002 → 409 with helpful message.** The DEDUP constraint trip currently returns `500 "Unexpected server error"` because `src/lib/server/http.ts:jsonError` doesn't recognize Prisma's `PrismaClientKnownRequestError`. Adding a branch — `if (error instanceof PrismaClientKnownRequestError && error.code === "P2002")` → 409 `{error: "A recurring rule with this title and cadence already exists for this entity", target: error.meta?.target}` — would turn the duplicate-create UX from "something broke" into "you already have one". Applies to every model that gets a future `@@unique`, not just RecurringRule. Worth doing before the next constraint lands.

2. **L1180 SSR caveat** — if a future refactor lifts `useSearchParams()` out of `LoginForm`, run a DOM probe to confirm the form's `method`/`action` attrs land in the SSR'd HTML. They're already in the JS bundle; that's enough today.

3. **Migration apply telemetry.** R8 had to `aws ssm` into EC2 to confirm the migration applied. A nice-to-have: after `prisma migrate deploy`, log the count of applied migrations to a CloudWatch log group, and have the deploy workflow assert `applied_count >= expected_count`. Avoids the silent "container restarted but didn't migrate" failure mode altogether. Out of scope today, but the moment a migration is risky/destructive, this becomes worth building.

