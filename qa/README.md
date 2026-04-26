# QA — Finance OS production audit

Eight rounds of agent-driven QA against `https://finance.elhilali.dev`, started 2026-04-25. Originally a single 1400-line ledger; split here for navigation.

## Where to look

- **What's still broken right now?** → [`open-bugs.md`](open-bugs.md). One file, severity-grouped, links back to the round that found it. This is the only doc you grep day-to-day.
- **What did Round N actually do?** → [`rounds/`](rounds/). One markdown per round, each is the immutable record of that audit.
- **The original 1400-line file?** → [`archive/QA_BUG_LEDGER.md`](archive/QA_BUG_LEDGER.md). Frozen pre-split snapshot. Don't edit.

## When you fix a bug

1. Make the fix. Ship it. Verify live at the wire (R6's lesson: a code-read is not a verification).
2. Tick the `[ ]` in **both** `open-bugs.md` and the originating round file.
3. If the fix touches enough surface area to warrant its own round (live verification of multiple items, new bugs found mid-fix), append a new `rounds/0N-<slug>.md` and link it from the round table below.

## Round index

| # | File | TL;DR |
|---|---|---|
| 1 | [`01-original-audit.md`](rounds/01-original-audit.md) | First sweep. 5 parallel agents found 70+ bugs across CRUD, validation, raw JSON leaks, FX/cross-page math, settings stub. |
| 2 | [`02-extended-coverage.md`](rounds/02-extended-coverage.md) | 5 fresh agents: security headers, accessibility, performance, FX i18n, blocked CRUD flows. CSRF + multi-tenancy + rate-limit gaps surfaced. |
| 3 | [`03-crud-verification.md`](rounds/03-crud-verification.md) | Re-verified R1+R2 ticks (mostly via code-reads). 5 untested surfaces covered: auth flows, a11y on remaining pages, perf past 150 rows, SEO/print/SW, browser permissions. |
| 4 | [`04-deploy-gap.md`](rounds/04-deploy-gap.md) | Wire-level re-probe revealed every R3 source-only fix was actually still broken in prod — 28 modified + 9 untracked files were sitting uncommitted. P0 deploy gap. |
| 5 | [`05-push-and-residuals.md`](rounds/05-push-and-residuals.md) | Closed the deploy gap (commit + push) and fixed 4 residual bugs. Items remain unverified live until R6 probes. |
| 6 | [`06-live-verification.md`](rounds/06-live-verification.md) | Wire-level live verify of R5's 19 pending items. 16 PASS, 3 security FAILs (same root cause), 1 partial regression. 3 new bugs in untested surfaces. |
| 7 | [`07-middleware-rename.md`](rounds/07-middleware-rename.md) | Diagnosed the 3 R6 security FAILs: Next.js 16 deprecated `middleware.ts` in favour of `src/proxy.ts`. Rename + 5 other fixes shipped. |
| 8 | [`08-r7-live-verification.md`](rounds/08-r7-live-verification.md) | Every R7 fix verified live at the wire. Closed the R6 Azlotv duplicate via partial unique index migration. |
| 9 | [`09-team-coverage.md`](rounds/09-team-coverage.md) | 5-agent team in two waves: all 6 R7/R8 fixes re-verified live (incl. write-bucket + login-bucket recovery); flows / 8 Edit dialogs / mobile-PWA / AI / edges covered. 11 new findings, headlined by P2 PATCH-validation-parity (negative cents writable on 6 routes) and P2 goal over-contribution. |

## Conventions

- Severity: **P0** = data loss / broken core feature, **P1** = degrades trust / unsafe default, **P2** = polish, **P3** = informational.
- Test data: prefix `[TEST-AGENT-R<N>-<area>]` so it's greppable. Cap at ~50 records per agent. Always clean up via `DELETE /api/<resource>/<id>` and final-sweep verify.
- Annotations on a fixed line: `✓ R<N>-verified <YYYY-MM-DD> — live PASS: <evidence>`.
- Annotations on a re-opened line: `✗ R<N> — live still broken: <evidence>`.

## Out of scope (deferred, do not re-flag)

- Multi-tenancy `userId` — gated until 2nd account
- `/reports` charts/exports/P&L — feature work
- 502/503 infrastructure flakiness — needs ops investigation
- Virtualization — superseded by R7 cursor pagination
- JWT revocation — schema migration, deferred until 2nd account
- Notification API — product gap, not a bug
