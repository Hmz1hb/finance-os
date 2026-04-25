import { describe, expect, it } from "vitest";
import { nextRecurringRuleDate } from "@/lib/finance/recurrence";
import { calculateMoroccoAeTax, calculateUkCorporationTax } from "@/lib/server/tax";
import { receivableStatus } from "@/lib/server/cashflows";

describe("entity-led recurrence", () => {
  it("advances rolling every-15-days schedules", () => {
    const next = nextRecurringRuleDate(new Date("2026-01-15T00:00:00.000Z"), {
      cadence: "INTERVAL_DAYS",
      intervalDays: 15,
    });
    expect(next.toISOString().slice(0, 10)).toBe("2026-01-30");
  });

  it("advances semi-monthly schedules to the configured second day", () => {
    const next = nextRecurringRuleDate(new Date("2026-01-15T00:00:00.000Z"), {
      cadence: "SEMI_MONTHLY",
      dayOfMonth: 15,
      secondDayOfMonth: 31,
    });
    expect(next.toISOString().slice(0, 10)).toBe("2026-01-31");
  });

  it("clamps monthly dates to month end", () => {
    const next = nextRecurringRuleDate(new Date("2026-01-31T00:00:00.000Z"), {
      cadence: "MONTHLY_DAY",
      dayOfMonth: 31,
    });
    expect(next.toISOString().slice(0, 10)).toBe("2026-02-28");
  });
});

describe("tax estimates", () => {
  it("uses UK small profits rate below the lower limit", () => {
    expect(calculateUkCorporationTax(4000000)).toBe(760000);
  });

  it("uses UK marginal relief between lower and upper limits", () => {
    expect(calculateUkCorporationTax(10000000)).toBe(2275000);
  });

  it("uses editable Morocco AE service and commerce rates", () => {
    expect(calculateMoroccoAeTax(10000000, 5000000, { serviceRate: 0.01, commerceRate: 0.005 })).toBe(125000);
  });
});

describe("receivable status", () => {
  it("marks partial payments separately from open and paid", () => {
    expect(receivableStatus({ amountCents: 10000, paidAmountCents: 2500, dueDate: null, status: "OPEN" })).toBe("PARTIAL");
  });

  it("keeps disputed receivables in disputed state", () => {
    expect(receivableStatus({ amountCents: 10000, paidAmountCents: 0, dueDate: new Date("2020-01-01"), status: "DISPUTED" })).toBe("DISPUTED");
  });
});
