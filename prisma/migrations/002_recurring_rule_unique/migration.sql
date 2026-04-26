-- R8 (2026-04-26): prevent the duplicate-recurring-rule footgun that landed
-- two identical "Azlotv LLC" SEMI_MONTHLY rules in prod (R6-NCOV-DUP-RULE).
-- Partial unique index because RecurringRule has soft-delete: once a rule is
-- deleted, its (entityId, title, cadence) slot must free up so the same
-- identity can be re-created. A plain @@unique would block re-creation until
-- the row is hard-deleted.
--
-- This index has no representation in schema.prisma — Prisma's DSL can't
-- express partial uniqueness. `prisma migrate deploy` (which runs at
-- container start, see Dockerfile L32) will still apply it; `prisma db pull`
-- would re-introspect it as a regular @@unique, which is wrong, so don't do
-- that without re-applying this file by hand.

CREATE UNIQUE INDEX "RecurringRule_entityId_title_cadence_active_uq"
  ON "RecurringRule" ("entityId", "title", "cadence")
  WHERE "deletedAt" IS NULL;
