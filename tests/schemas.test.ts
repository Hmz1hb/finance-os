import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ContextMode,
  Currency,
  GoalCategory,
  LoanKind,
  OwnerCompensationType,
  ReceivableKind,
  ReceivableStatus,
  RecurrenceFrequency,
  RecurringCadence,
  RecurringRuleType,
  SubscriptionStatus,
  TransactionType,
} from "@prisma/client";
import {
  interestRate,
  interestRateOptional,
  loanDateRefinement,
  nonNegativeAmount,
  nonNegativeAmountOptional,
  positiveAmount,
  positiveAmountOptional,
  recurringRuleRefinement,
} from "../src/lib/server/schemas";

// These tests mirror the live route schemas using the SAME shared primitives
// the route files import. If a route file ever stops importing the primitive,
// or wraps it in a way that drops the refinement, the route's behavior will
// diverge from these tests — but the primitives themselves are the load-
// bearing piece, so testing them via these mirror schemas guarantees that
// any route using them is correct by construction.
//
// Each "POST schema" below is a copy of what `src/app/api/<resource>/route.ts`
// constructs; each "PATCH schema" mirrors `src/app/api/<resource>/[id]/route.ts`.
// Every monetary field uses the shared `positiveAmount(Optional)` /
// `nonNegativeAmount(Optional)` primitive — that is the parity contract.

// ---------- Mirror schemas (POST + PATCH) ---------- //

const transactionsPost = z.object({
  date: z.coerce.date(),
  kind: z.enum(TransactionType),
  context: z.enum(ContextMode),
  amount: positiveAmount,
  currency: z.enum(Currency),
  description: z.string().min(1),
});

const transactionsPatch = z.object({
  amount: positiveAmountOptional,
  currency: z.enum(Currency).optional(),
  description: z.string().min(1).optional(),
});

const loansPost = z
  .object({
    kind: z.enum(LoanKind),
    lenderName: z.string().min(1),
    originalAmount: positiveAmount,
    currency: z.enum(Currency),
    interestRate: interestRate.default(0),
    monthlyPayment: positiveAmount,
    startDate: z.coerce.date(),
    expectedPayoffDate: z.coerce.date().optional().nullable(),
    remainingBalance: positiveAmount,
  })
  .superRefine(loanDateRefinement);

const loansPatch = z
  .object({
    originalAmount: positiveAmountOptional,
    interestRate: interestRateOptional,
    monthlyPayment: positiveAmountOptional,
    remainingBalance: positiveAmountOptional,
    startDate: z.coerce.date().optional(),
    expectedPayoffDate: z.coerce.date().optional().nullable(),
  })
  .superRefine(loanDateRefinement);

const goalsPost = z.object({
  name: z.string().min(1),
  targetAmount: positiveAmount,
  currency: z.enum(Currency),
  currentSaved: nonNegativeAmountOptional,
  category: z.enum(GoalCategory),
});

const goalsPatch = z.object({
  targetAmount: positiveAmountOptional,
  currentSaved: nonNegativeAmountOptional,
});

const subscriptionsPost = z.object({
  name: z.string().min(1),
  context: z.enum(ContextMode),
  amount: positiveAmount,
  currency: z.enum(Currency),
  billingCycle: z.enum(RecurrenceFrequency),
  nextBillingDate: z.coerce.date(),
  category: z.string().min(1),
});

const subscriptionsPatch = z.object({
  amount: positiveAmountOptional,
  status: z.enum(SubscriptionStatus).optional(),
});

const receivablesPost = z.object({
  entityId: z.string().min(1),
  kind: z.enum(ReceivableKind),
  counterparty: z.string().min(1),
  title: z.string().min(1),
  issueDate: z.coerce.date(),
  amount: positiveAmount,
  currency: z.enum(Currency),
});

const receivablesPatch = z.object({
  amount: positiveAmountOptional,
  status: z.enum(ReceivableStatus).optional(),
});

const ownerPayPost = z.object({
  date: z.coerce.date(),
  amount: positiveAmount,
  currency: z.enum(Currency),
  paymentType: z.enum(OwnerCompensationType),
});

const ownerPayPatch = z.object({
  amount: positiveAmountOptional,
});

const recurringRulesPost = z
  .object({
    entityId: z.string().min(1),
    title: z.string().min(1),
    ruleType: z.enum(RecurringRuleType).default("EXPECTED_INCOME"),
    cadence: z.enum(RecurringCadence),
    intervalDays: z.coerce.number().int().positive().optional().nullable(),
    dayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
    secondDayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional().nullable(),
    amount: positiveAmount,
    currency: z.enum(Currency),
  })
  .superRefine(recurringRuleRefinement);

const recurringRulesPatch = z
  .object({
    cadence: z.enum(RecurringCadence).optional(),
    intervalDays: z.coerce.number().int().positive().optional().nullable(),
    dayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
    secondDayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional().nullable(),
    amount: positiveAmountOptional,
  })
  .superRefine(recurringRuleRefinement);

// ---------- Helpers ---------- //

function fail(schema: z.ZodTypeAny, body: unknown, expectMessage?: RegExp) {
  const result = schema.safeParse(body);
  expect(result.success, `expected schema parse to fail for ${JSON.stringify(body)}`).toBe(
    false,
  );
  if (!result.success && expectMessage) {
    const text = result.error.issues.map((i) => i.message).join(" | ");
    expect(text, `actual issues: ${text}`).toMatch(expectMessage);
  }
}

function pass(schema: z.ZodTypeAny, body: unknown) {
  const result = schema.safeParse(body);
  const message = result.success
    ? ""
    : `unexpected failure: ${JSON.stringify(result.error.issues)}`;
  expect(result.success, message).toBe(true);
}

// Valid baseline payloads we can spread into negative cases.
// Typed as `Record<string, Record<string, unknown>>` so tests can override
// individual fields (including unsetting via `undefined`) without fighting
// TypeScript narrowing.
const validPostBase: Record<string, Record<string, unknown>> = {
  transactions: {
    date: new Date(),
    kind: "EXPENSE",
    context: "PERSONAL",
    amount: 10,
    currency: "MAD",
    description: "test",
  },
  loans: {
    kind: "OWED_BY_ME",
    lenderName: "x",
    originalAmount: 100,
    currency: "USD",
    interestRate: 0.05,
    monthlyPayment: 10,
    startDate: new Date("2026-01-01"),
    remainingBalance: 100,
  },
  goals: {
    name: "g",
    targetAmount: 100,
    currency: "MAD",
    category: "NEEDS",
  },
  subscriptions: {
    name: "x",
    context: "PERSONAL",
    amount: 10,
    currency: "MAD",
    billingCycle: "MONTHLY",
    nextBillingDate: new Date(),
    category: "Software",
  },
  receivables: {
    entityId: "uk_ltd",
    kind: "CLIENT_INVOICE",
    counterparty: "Acme",
    title: "Invoice 1",
    issueDate: new Date(),
    amount: 100,
    currency: "GBP",
  },
  ownerPay: {
    date: new Date(),
    amount: 100,
    currency: "USD",
    paymentType: "SALARY",
  },
  recurringRules: {
    entityId: "uk_ltd",
    title: "rule",
    cadence: "MONTHLY_DAY",
    dayOfMonth: 15,
    startDate: new Date("2026-01-01"),
    amount: 100,
    currency: "USD",
  },
};

// ---------- Primitive sanity ---------- //

describe("positiveAmount primitive", () => {
  it("accepts strict positives that round to >=1 cent", () => {
    pass(z.object({ a: positiveAmount }), { a: "0.01" });
    pass(z.object({ a: positiveAmount }), { a: 1 });
    pass(z.object({ a: positiveAmount }), { a: "1,234.56" });
  });
  it("rejects negatives", () => {
    fail(z.object({ a: positiveAmount }), { a: -5 }, /greater than 0/);
  });
  it("rejects zero", () => {
    fail(z.object({ a: positiveAmount }), { a: 0 }, /greater than 0/);
  });
  it("rejects values that round to 0 cents (R9-EDGES-001)", () => {
    fail(z.object({ a: positiveAmount }), { a: "0.004" }, /at least 0\.01/);
  });
  it("rejects non-finite", () => {
    fail(z.object({ a: positiveAmount }), { a: "abc" }, /greater than 0/);
  });
});

describe("nonNegativeAmount primitive", () => {
  it("accepts 0", () => {
    pass(z.object({ a: nonNegativeAmount }), { a: 0 });
  });
  it("rejects negatives", () => {
    fail(z.object({ a: nonNegativeAmount }), { a: -1 }, />= 0/);
  });
});

describe("interestRate primitive", () => {
  it("accepts decimals in [0, 1]", () => {
    pass(z.object({ r: interestRate }), { r: 0 });
    pass(z.object({ r: interestRate }), { r: 0.05 });
    pass(z.object({ r: interestRate }), { r: 1 });
  });
  it("rejects > 1", () => {
    fail(z.object({ r: interestRate }), { r: 5 }, /decimal rate/);
  });
});

// ---------- Per-resource PATCH parity ---------- //

describe("PATCH/POST parity — `> 0` on monetary fields (R9-EDIT-001)", () => {
  it("transactions PATCH rejects amount: -5", () => {
    fail(transactionsPatch, { amount: -5 }, /greater than 0/);
  });
  it("transactions POST also rejects amount: -5 (parity)", () => {
    fail(transactionsPost, { ...validPostBase.transactions, amount: -5 }, /greater than 0/);
  });

  it("loans PATCH rejects originalAmount: -1", () => {
    fail(loansPatch, { originalAmount: -1 }, /greater than 0/);
  });
  it("loans POST also rejects originalAmount: -1 (parity)", () => {
    fail(loansPost, { ...validPostBase.loans, originalAmount: -1 }, /greater than 0/);
  });

  it("goals PATCH rejects targetAmount: -1", () => {
    fail(goalsPatch, { targetAmount: -1 }, /greater than 0/);
  });
  it("goals POST also rejects targetAmount: -1 (parity)", () => {
    fail(goalsPost, { ...validPostBase.goals, targetAmount: -1 }, /greater than 0/);
  });

  it("subscriptions PATCH rejects amount: -2", () => {
    fail(subscriptionsPatch, { amount: -2 }, /greater than 0/);
  });
  it("subscriptions POST also rejects amount: -2 (parity)", () => {
    fail(subscriptionsPost, { ...validPostBase.subscriptions, amount: -2 }, /greater than 0/);
  });

  it("receivables PATCH rejects amount: -3", () => {
    fail(receivablesPatch, { amount: -3 }, /greater than 0/);
  });
  it("receivables POST also rejects amount: -3 (parity)", () => {
    fail(receivablesPost, { ...validPostBase.receivables, amount: -3 }, /greater than 0/);
  });

  it("owner-pay PATCH rejects amount: -4", () => {
    fail(ownerPayPatch, { amount: -4 }, /greater than 0/);
  });
  it("owner-pay POST also rejects amount: -4 (parity)", () => {
    fail(ownerPayPost, { ...validPostBase.ownerPay, amount: -4 }, /greater than 0/);
  });

  it("recurring-rules PATCH rejects amount: -7", () => {
    fail(recurringRulesPatch, { amount: -7 }, /greater than 0/);
  });
  it("recurring-rules POST also rejects amount: -7 (parity)", () => {
    fail(recurringRulesPost, { ...validPostBase.recurringRules, amount: -7 }, /greater than 0/);
  });
});

describe("PATCH/POST parity — rounded-cents floor (R9-EDGES-001)", () => {
  it("transactions PATCH rejects amount: '0.004' (rounds to 0 cents)", () => {
    fail(transactionsPatch, { amount: "0.004" }, /at least 0\.01/);
  });
  it("transactions POST also rejects amount: '0.004' (parity)", () => {
    fail(
      transactionsPost,
      { ...validPostBase.transactions, amount: "0.004" },
      /at least 0\.01/,
    );
  });
});

describe("PATCH/POST parity — loans interestRate ∈ [0, 1] (R9-EDIT-002)", () => {
  it("loans PATCH rejects interestRate: 5", () => {
    fail(loansPatch, { interestRate: 5 }, /decimal rate/);
  });
  it("loans POST also rejects interestRate: 5 (parity)", () => {
    fail(loansPost, { ...validPostBase.loans, interestRate: 5 }, /decimal rate/);
  });
});

describe("PATCH/POST parity — loans expectedPayoffDate > startDate (R9-EDIT-003)", () => {
  it("loans PATCH rejects expectedPayoffDate <= startDate when both present", () => {
    fail(
      loansPatch,
      {
        startDate: new Date("2026-01-01"),
        expectedPayoffDate: new Date("2026-01-01"),
      },
      /after start date/,
    );
  });
  it("loans PATCH passes when only one of the two fields is present (per-patch contract)", () => {
    pass(loansPatch, { expectedPayoffDate: new Date("1999-01-01") });
    pass(loansPatch, { startDate: new Date("2026-01-01") });
  });
  it("loans POST also rejects expectedPayoffDate <= startDate (parity)", () => {
    fail(
      loansPost,
      {
        ...validPostBase.loans,
        startDate: new Date("2026-01-01"),
        expectedPayoffDate: new Date("2026-01-01"),
      },
      /after start date/,
    );
  });
});

describe("PATCH/POST parity — goals currentSaved >= 0 (R9-EDIT-004)", () => {
  it("goals PATCH rejects currentSaved: -1", () => {
    fail(goalsPatch, { currentSaved: -1 }, />= 0/);
  });
  it("goals POST also rejects currentSaved: -1 (parity)", () => {
    fail(goalsPost, { ...validPostBase.goals, currentSaved: -1 }, />= 0/);
  });
});

describe("PATCH/POST parity — recurring-rules superRefine (R9-EDIT-005)", () => {
  it("recurring-rules PATCH rejects cadence: SEMI_MONTHLY without dayOfMonth", () => {
    // A patch that flips to SEMI_MONTHLY but leaves dayOfMonth and
    // secondDayOfMonth unset must error on both required fields.
    fail(
      recurringRulesPatch,
      { cadence: "SEMI_MONTHLY" },
      /dayOfMonth required for monthly cadences/,
    );
  });
  it("recurring-rules PATCH rejects cadence: SEMI_MONTHLY missing secondDayOfMonth", () => {
    fail(
      recurringRulesPatch,
      { cadence: "SEMI_MONTHLY", dayOfMonth: 15 },
      /secondDayOfMonth required for SEMI_MONTHLY/,
    );
  });
  it("recurring-rules PATCH accepts cadence: SEMI_MONTHLY with both day fields", () => {
    pass(recurringRulesPatch, {
      cadence: "SEMI_MONTHLY",
      dayOfMonth: 1,
      secondDayOfMonth: 15,
    });
  });
  it("recurring-rules PATCH rejects cadence: INTERVAL_DAYS without intervalDays", () => {
    fail(
      recurringRulesPatch,
      { cadence: "INTERVAL_DAYS" },
      /intervalDays required for INTERVAL_DAYS/,
    );
  });
  it("recurring-rules PATCH rejects endDate <= startDate when both present", () => {
    fail(
      recurringRulesPatch,
      {
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-01"),
      },
      /endDate must be after startDate/,
    );
  });
  it("recurring-rules PATCH passes when only endDate is present (no cross-check)", () => {
    pass(recurringRulesPatch, { endDate: new Date("1999-01-01") });
  });
  it("recurring-rules POST also rejects SEMI_MONTHLY without dayOfMonth (parity)", () => {
    fail(
      recurringRulesPost,
      {
        ...validPostBase.recurringRules,
        cadence: "SEMI_MONTHLY",
        dayOfMonth: undefined,
        secondDayOfMonth: undefined,
      },
      /dayOfMonth required for monthly cadences/,
    );
  });
  it("recurring-rules POST also rejects endDate <= startDate (parity)", () => {
    fail(
      recurringRulesPost,
      {
        ...validPostBase.recurringRules,
        endDate: new Date("2025-01-01"),
      },
      /endDate must be after startDate/,
    );
  });
});

describe("Happy-path sanity (positive baselines parse cleanly)", () => {
  it("transactions POST + PATCH accept valid payloads", () => {
    pass(transactionsPost, validPostBase.transactions);
    pass(transactionsPatch, { amount: 1.5 });
    pass(transactionsPatch, {});
  });
  it("loans POST + PATCH accept valid payloads", () => {
    pass(loansPost, validPostBase.loans);
    pass(loansPatch, { originalAmount: 1, monthlyPayment: 1, remainingBalance: 1 });
  });
  it("goals POST + PATCH accept valid payloads (currentSaved=0 allowed)", () => {
    pass(goalsPost, validPostBase.goals);
    pass(goalsPost, { ...validPostBase.goals, currentSaved: 0 });
    pass(goalsPatch, { targetAmount: 5, currentSaved: 0 });
  });
  it("subscriptions POST + PATCH accept valid payloads", () => {
    pass(subscriptionsPost, validPostBase.subscriptions);
    pass(subscriptionsPatch, { amount: 1 });
  });
  it("receivables POST + PATCH accept valid payloads", () => {
    pass(receivablesPost, validPostBase.receivables);
    pass(receivablesPatch, { amount: 1 });
  });
  it("owner-pay POST + PATCH accept valid payloads", () => {
    pass(ownerPayPost, validPostBase.ownerPay);
    pass(ownerPayPatch, { amount: 1 });
  });
  it("recurring-rules POST + PATCH accept valid payloads", () => {
    pass(recurringRulesPost, validPostBase.recurringRules);
    pass(recurringRulesPatch, { amount: 1 });
  });
});
