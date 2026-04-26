# Round 7 — appended 2026-04-26

## TL;DR — security trio fixed by a Next.js 16 file rename; 3 residual bugs closed

R6's three FAIL items (L297 CSRF text/plain, L360 write rate-limit, L784 login bruteforce) all shared one root cause R6 didn't have a name for: **Next.js 16 deprecated the `middleware.ts` filename in favour of `proxy.ts`** (documented in `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md:625-650` and `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md:13-15`). The middleware source was correct, the local vitest passed, but `next build` silently ignored `middleware.ts` and shipped an empty `.next/server/middleware-manifest.json` — so no guard ran at the wire.

R6's diagnostic plan correctly suspected "the deployed bundle's `middleware-manifest.json` lacks the matcher" but stopped short of the v16 deprecation. The AGENTS.md warning ("This is NOT the Next.js you know — read the relevant guide in `node_modules/next/dist/docs/` before writing any code") is exactly the failure mode this round resolves.

### Fixes shipped

| Item | Severity | Fix |
|---|---|---|
| L297 / L1137 — CSRF text/plain bypass | P0 | `git mv middleware.ts src/proxy.ts` (must be inside `src/` for src-layout projects per the proxy doc); fixed `auth` import to `../auth`. Build now logs `ƒ Proxy (Middleware)` and `.next/server/middleware.js` (555KB) contains the guard strings. |
| L360 / L1143 — Write rate limit not gating | P1 | Same rename — the `consumeRateBudget` call site was always correct. |
| L784 / L1145 — Login bruteforce limit not gating | P1 | Same rename — the credentials-callback special-case was always correct. |
| L724 / L1149 — Legacy `?year=` returns envelope | P3 | `Number(null) === 0` and `Number.isFinite(0) === true`, so `usePagination` flipped to true on every request. Gated on `params.has("limit")` instead. New regression test at `tests/transactions-legacy-year.test.ts`. |
| L1173 — `/transactions` date column UTC slice | P2 | Replaced `transaction.date.slice(0, 10)` with `Intl.DateTimeFormat("en-CA", ...)` that uses the browser's resolved local TZ. Africa/Casablanca midnight-local entries now show the correct day. |
| L1180 — Login form no `method`/`action` | P2 | Added `method="post" action="/login"` to the form element so a JS-load failure can't leak credentials via a default GET. The `onSubmit` `event.preventDefault()` keeps the JS path unchanged. |

### Local verification

- `npm run typecheck` ✓
- `npm run lint` ✓
- `npm run test` → **32/32 pass** (was 27 before; +5 from the new `transactions-legacy-year.test.ts`)
- `npm run build` → emits `ƒ Proxy (Middleware)` and `.next/server/middleware.js` (555KB)
- `grep "Too many requests\|Too many login attempts" .next/server/middleware.js` → both strings present (proof the proxy compiled into the production bundle)

### Pending live verification (post-deploy)

Per R4/R5 discipline ("a code-read is not a live verification"), the security trio remains code-verified only until the GitHub Actions OIDC → S3 → SSM deploy completes. R7's `[x]` ticks for L297, L360, L784, L1137, L1143, L1145 carry "Pending live verification post-deploy" annotations. A round 8 should re-run the wire-level probes:

- `POST /api/transactions` with `Content-Type: text/plain` → expect 415
- 31 sequential `POST /api/transactions` → expect 30× 200 then 429 with `Retry-After`
- 11 bogus `POST /api/auth/callback/credentials` → expect 11th to be 429
- `GET /api/transactions?year=2026` → expect bare array (`Array.isArray(json) === true`)
- View `/login` source → confirm `<form method="post" action="/login">`
- Add a transaction with date 23:30 local → ledger row shows today's date

### Out of scope (intentionally not touched)

- L180 `/reports` charts/exports (feature build, not a bug).
- L199 / L202 / L205 infrastructure investigations.
- L307 multi-tenancy `userId` (deferred until 2nd account).
- L467, L470, L475 P3 informational entries.
- L628, L768, L806, L812, L818, L826, L863 P3 coverage / informational notes.
- L798 JWT revocation (needs schema migration).
- L1018 R4-DEPLOY tracker (resolved by R5/R7 — the actual remaining gap was the v16 rename, not deploy plumbing).
- L1044 virtualization (no longer urgent post-cursor pagination).
- L1187 duplicate "Azlotv LLC" rule (Hamza's own data — manual cleanup, not code).

### Files changed

- `middleware.ts` → `src/proxy.ts` (`git mv`; `import { auth } from "./auth"` → `"../auth"`)
- `tests/middleware-csrf.test.ts` — import path updated
- `tests/middleware-rate-limit.test.ts` — import path updated
- `tests/transactions-legacy-year.test.ts` (new) — 5 cases covering the bare-array vs envelope branching
- `src/app/api/transactions/route.ts` — `usePagination` now gated on `params.has("limit")`
- `src/components/app/transactions-ledger.tsx` — Intl-formatted local YMD helper
- `src/components/app/login-form.tsx` — `method="post" action="/login"`
- `QA_BUG_LEDGER.md` — this section + 8 ticks above

