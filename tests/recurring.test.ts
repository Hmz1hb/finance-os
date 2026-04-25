import { describe, expect, it } from "vitest";
import { nextDate } from "@/lib/server/recurring";
import { nextRecurringRuleDate } from "@/lib/finance/recurrence";

describe("recurring engine", () => {
  const date = new Date("2026-01-15T00:00:00.000Z");

  it("advances biweekly templates by two weeks", () => {
    expect(nextDate(date, "BIWEEKLY").toISOString().slice(0, 10)).toBe("2026-01-29");
  });

  it("advances quarterly templates by three months", () => {
    expect(nextDate(date, "QUARTERLY").toISOString().slice(0, 10)).toBe("2026-04-15");
  });
});

describe("recurring generator", () => {
  const date = new Date("2026-01-15T00:00:00.000Z");

  it("advances INTERVAL_DAYS rule by the configured intervalDays", () => {
    const next = nextRecurringRuleDate(date, { cadence: "INTERVAL_DAYS", intervalDays: 15 });
    expect(next.toISOString().slice(0, 10)).toBe("2026-01-30");
  });

  it("falls back to a 15-day interval when intervalDays is missing", () => {
    const next = nextRecurringRuleDate(date, { cadence: "INTERVAL_DAYS" });
    expect(next.toISOString().slice(0, 10)).toBe("2026-01-30");
  });

  it("advances MONTHLY_DAY rule onto the configured day of next month", () => {
    const next = nextRecurringRuleDate(date, { cadence: "MONTHLY_DAY", dayOfMonth: 5 });
    expect(next.toISOString().slice(0, 10)).toBe("2026-02-05");
  });

  it("clamps MONTHLY_DAY to the last day when the target month is shorter", () => {
    const jan31 = new Date("2026-01-31T00:00:00.000Z");
    const next = nextRecurringRuleDate(jan31, { cadence: "MONTHLY_DAY", dayOfMonth: 31 });
    expect(next.toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("advances WEEKLY rule by seven days", () => {
    const next = nextRecurringRuleDate(date, { cadence: "WEEKLY" });
    expect(next.toISOString().slice(0, 10)).toBe("2026-01-22");
  });
});
