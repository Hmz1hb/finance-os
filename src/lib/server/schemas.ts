import { z } from "zod";
import { toCents } from "@/lib/finance/money";

// Shared Zod primitives for monetary, rate, and cross-field invariants.
//
// These are reused by every POST + PATCH route that takes amounts so the two
// schemas can never drift again (R9-EDIT-001..005, R9-EDGES-001).
//
// Design note: `positiveAmount` keeps the parsed output as `string | number`
// (i.e. it does NOT transform into cents). The refinement internally calls
// `toCents` so it can assert `cents >= 1` — this catches BOTH negatives AND
// the `0.004 → rounds to 0` boundary in a single primitive, while letting
// every existing route handler keep its `toCents(parsed.amount)` call. The
// alternative — transform the schema's output type to `number` (cents) — was
// rejected because it would have rippled into helper signatures
// (createReceivable, createOwnerCompensation, createRecurringRule) that
// currently take `amount: string | number`.

export const MAX_AMOUNT_CENTS = 1_000_000_000_000;

const RAW_AMOUNT_MESSAGE = "Amount must be greater than 0";
const ROUNDED_ZERO_MESSAGE = "Amount must be at least 0.01";
const NON_NEGATIVE_MESSAGE = "Amount must be >= 0";
const RATE_MESSAGE = "Use a decimal rate (0.05 = 5%)";

function parseRawAmount(value: string | number): number | null {
  const numeric = Number(typeof value === "string" ? value.replace(/,/g, "") : value);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

/**
 * Strictly positive monetary input that survives rounding to cents.
 *
 * Rejects:
 *   - non-finite / unparseable
 *   - <= 0 raw
 *   - rounds to 0 cents (e.g. `0.004 GBP`)
 *   - exceeds MAX_AMOUNT_CENTS
 *
 * Output type: `string | number` (unchanged from input). Handlers continue
 * to call `toCents(parsed.amount)` after parse.
 */
export const positiveAmount = z
  .union([z.string(), z.number()])
  .superRefine((value, ctx) => {
    const numeric = parseRawAmount(value);
    if (numeric === null) {
      ctx.addIssue({ code: "custom", message: RAW_AMOUNT_MESSAGE });
      return;
    }
    if (numeric <= 0) {
      ctx.addIssue({ code: "custom", message: RAW_AMOUNT_MESSAGE });
      return;
    }
    let cents: number;
    try {
      cents = toCents(value);
    } catch {
      ctx.addIssue({ code: "custom", message: RAW_AMOUNT_MESSAGE });
      return;
    }
    if (cents < 1) {
      ctx.addIssue({ code: "custom", message: ROUNDED_ZERO_MESSAGE });
      return;
    }
    if (cents >= MAX_AMOUNT_CENTS) {
      ctx.addIssue({
        code: "custom",
        message: "Amount must be > 0 and within reasonable bounds",
      });
    }
  });

export const positiveAmountOptional = positiveAmount.optional();

/**
 * Non-negative monetary input — `0` allowed, negatives rejected.
 * Used for `goals.currentSaved` (a goal can start with $0 saved).
 */
export const nonNegativeAmount = z
  .union([z.string(), z.number()])
  .superRefine((value, ctx) => {
    const numeric = parseRawAmount(value);
    if (numeric === null || numeric < 0) {
      ctx.addIssue({ code: "custom", message: NON_NEGATIVE_MESSAGE });
      return;
    }
    let cents: number;
    try {
      cents = toCents(value);
    } catch {
      ctx.addIssue({ code: "custom", message: NON_NEGATIVE_MESSAGE });
      return;
    }
    if (cents < 0) {
      ctx.addIssue({ code: "custom", message: NON_NEGATIVE_MESSAGE });
    }
    if (cents >= MAX_AMOUNT_CENTS) {
      ctx.addIssue({
        code: "custom",
        message: "Amount must be within reasonable bounds",
      });
    }
  });

export const nonNegativeAmountOptional = nonNegativeAmount.optional();

/**
 * Decimal interest rate clamped to [0, 1] (0.05 = 5%).
 */
export const interestRate = z.coerce.number().min(0).max(1, RATE_MESSAGE);
export const interestRateOptional = interestRate.optional();

/**
 * Cross-field refinement for loans: `expectedPayoffDate > startDate`.
 *
 * On PATCH the helper only fires when BOTH fields are present in the
 * request body — partial updates that touch only one of the two are passed
 * through without inventing the missing half from the DB. This matches the
 * "patch what was sent" semantics of every other PATCH route in the codebase.
 */
export function loanDateRefinement(
  value: { startDate?: Date | null; expectedPayoffDate?: Date | null },
  ctx: z.RefinementCtx,
) {
  if (
    value.startDate instanceof Date &&
    value.expectedPayoffDate instanceof Date &&
    value.expectedPayoffDate <= value.startDate
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["expectedPayoffDate"],
      message: "Expected payoff date must be after start date",
    });
  }
}

type RecurringRuleShape = {
  cadence?: string | null;
  intervalDays?: number | null;
  dayOfMonth?: number | null;
  secondDayOfMonth?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
};

/**
 * Cross-field refinement for recurring rules:
 *   (a) `intervalDays` required for INTERVAL_DAYS
 *   (b) `dayOfMonth` required for MONTHLY_DAY / SEMI_MONTHLY
 *   (c) `secondDayOfMonth` required for SEMI_MONTHLY
 *   (d) `endDate > startDate` when both present
 *
 * On PATCH the cadence-vs-day checks only fire when `cadence` is present in
 * the patch body (i.e. the caller is actively flipping the cadence). If the
 * caller only updates `dayOfMonth` without touching `cadence`, we assume the
 * existing record already satisfies the cadence's requirements. Likewise the
 * `endDate` / `startDate` cross-check only fires when both are present in
 * the patch.
 */
export function recurringRuleRefinement(value: RecurringRuleShape, ctx: z.RefinementCtx) {
  if (value.cadence === "INTERVAL_DAYS" && !value.intervalDays) {
    ctx.addIssue({
      code: "custom",
      path: ["intervalDays"],
      message: "intervalDays required for INTERVAL_DAYS cadence",
    });
  }
  if (
    (value.cadence === "MONTHLY_DAY" || value.cadence === "SEMI_MONTHLY") &&
    !value.dayOfMonth
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["dayOfMonth"],
      message: "dayOfMonth required for monthly cadences",
    });
  }
  if (value.cadence === "SEMI_MONTHLY" && !value.secondDayOfMonth) {
    ctx.addIssue({
      code: "custom",
      path: ["secondDayOfMonth"],
      message: "secondDayOfMonth required for SEMI_MONTHLY cadence",
    });
  }
  if (
    value.endDate instanceof Date &&
    value.startDate instanceof Date &&
    value.endDate <= value.startDate
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "endDate must be after startDate",
    });
  }
}
