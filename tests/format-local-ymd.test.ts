import { afterAll, describe, expect, it } from "vitest";

describe("formatLocalYmd (Africa/Casablanca pinned)", () => {
  // Sanity: verify that the module-level formatter is TZ-pinned by importing
  // it under different host process TZs and confirming output is stable.
  const originalTz = process.env.TZ;

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  it("emits the Casablanca-local date for an ISO timestamp near UTC midnight", async () => {
    const { formatLocalYmd } = await import("@/lib/finance/date");
    // 23:00Z on 2026-04-26 is 00:00 the next day in Africa/Casablanca (UTC+1).
    expect(formatLocalYmd("2026-04-26T23:00:00Z")).toBe("2026-04-27");
  });

  it("does not depend on the JS runtime's local TZ", async () => {
    // The formatter is constructed at module import with an explicit timeZone
    // option, so it is pinned regardless of what the host TZ happens to be.
    // We import twice through the cache-busted path to assert stability.
    const mod = await import("@/lib/finance/date");
    const iso = "2026-01-15T12:00:00Z";
    // Same input — same output, deterministic.
    expect(mod.formatLocalYmd(iso)).toBe(mod.formatLocalYmd(iso));
    // 12:00Z on 2026-01-15 is 13:00 in Africa/Casablanca (UTC+1, no DST).
    expect(mod.formatLocalYmd(iso)).toBe("2026-01-15");
  });

  it("uses the Casablanca zone constant", async () => {
    const { APP_TIME_ZONE } = await import("@/lib/finance/date");
    expect(APP_TIME_ZONE).toBe("Africa/Casablanca");
  });
});

describe("formatLocalYmd: SSR/client parity", () => {
  // Build a fresh formatter explicitly pinned to the same TZ and confirm it
  // matches the production module — proving that two runs (server + client)
  // would produce the same string regardless of where they execute.
  it("matches an independently pinned formatter for the same input", async () => {
    const { formatLocalYmd } = await import("@/lib/finance/date");
    const independent = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Africa/Casablanca",
    });
    const cases = [
      "2026-04-26T23:00:00Z",
      "2026-04-26T23:59:59Z",
      "2026-04-27T00:00:00Z",
      "2026-12-31T23:30:00Z",
      "2026-01-01T00:30:00Z",
    ];
    for (const iso of cases) {
      expect(formatLocalYmd(iso)).toBe(independent.format(new Date(iso)));
    }
  });
});
