# Round 5 — appended 2026-04-26

## TL;DR — deploy gap closed + 4 residual bugs fixed

The R4 deploy-gap (28 modified + 9 untracked files sitting in the working tree) was closed by committing + pushing every "Fix 2026-04-25" annotation to `origin/main`. GitHub Actions OIDC → S3 → SSM auto-deploy will redeploy EC2 `i-0c1f380bdbc9a09c8`. Per Hamza's instruction, `QA_BUG_LEDGER.md` itself was deliberately NOT included in the push and remains as a local working-tree change.

R5 also fixed 4 residual code bugs that were genuinely missing from the working tree:

| Item | Severity | Fix location |
|---|---|---|
| L587 — Edit on /payroll, /income-schedules, /categories | P1 | new owner-pay-row.tsx, recurring-rule-row.tsx, category-row.tsx; 3 page edits |
| L903 / L1040 — EntityRail vs Cockpit baseline gap | P3 | cockpit.ts:44 — added `date <= now` filter to entityRailSummary's cashBalanceCents |
| L1042 — CSV header-row error message | P2 | csv/route.ts:29 — appended `Expected at minimum: amount, date` |
| L1038 — phantom "Invalid Date" in 400 envelopes | P3 | http.ts:16-29 — `summarizeZodIssues` rewrites Zod 4's paradoxical "expected date, received Date" artifact; tests/parse-json-date-envelope.test.ts regression-tests it |

Local verification: `npm run typecheck && npm run lint && npm run test` → 27/27 tests pass, no type errors, no lint errors.

## Round 5 — pushed-but-awaits-live-verification

The 19 ledger items that R4 flipped back to `[ ]` due to the deploy gap will be re-verifiable once the GitHub Actions deploy completes. They are NOT being ticked here because R4's discipline note is correct: a code-read is not a live verification. They remain `[ ]` with their existing `✗ R4 deploy-gap` annotations until a Round 6 agent (or Hamza) re-runs the wire-level probes against the new live bundle.

**Items pending live re-verification:** L297, L360, L622, L758, L763, L778, L784, L792, L850, L857, L892, L929, L934, L939, L718, L724, L159, L587 (5-page partial → 8-page full), L594.

## Round 5 — out of scope (intentionally not touched)

- L307 multi-tenancy `userId` (deferred until 2nd account)
- L180 `/reports` charts/exports/P&L feature
- L199 / L202 / L205 infrastructure / phantom-negative investigations
- L798 JWT revocation strategy
- L863, L628, L768, L806, L812, L818, L826, L1044 — informational P3 / coverage / product-gap notes

---
