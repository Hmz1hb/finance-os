import { describe, expect, it } from "vitest";
import { nextDate } from "@/lib/server/recurring";

describe("recurring engine", () => {
  const date = new Date("2026-01-15T00:00:00.000Z");

  it("advances biweekly templates by two weeks", () => {
    expect(nextDate(date, "BIWEEKLY").toISOString().slice(0, 10)).toBe("2026-01-29");
  });

  it("advances quarterly templates by three months", () => {
    expect(nextDate(date, "QUARTERLY").toISOString().slice(0, 10)).toBe("2026-04-15");
  });
});
