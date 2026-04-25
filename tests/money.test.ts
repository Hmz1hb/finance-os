import { describe, expect, it } from "vitest";
import { Currency } from "@prisma/client";
import { convertToMad, formatMoney, savingsRate, toCents } from "@/lib/finance/money";

describe("money utilities", () => {
  it("stores decimal money as integer minor units", () => {
    expect(toCents("123.45")).toBe(12345);
    expect(toCents(10.1)).toBe(1010);
  });

  it("formats supported currencies", () => {
    expect(formatMoney(123456, Currency.MAD)).toContain("1");
    expect(formatMoney(123456, Currency.MAD)).toContain("234");
    expect(formatMoney(123456, Currency.MAD)).toContain("56");
    expect(formatMoney(123456, Currency.MAD)).toContain("د.م.");
    expect(formatMoney(123456, Currency.GBP)).toContain("£1,234.56");
  });

  it("converts using exchange-rate snapshots", () => {
    expect(convertToMad(320000, 12.5)).toBe(4000000);
  });

  it("calculates savings rate from income and expenses", () => {
    expect(savingsRate(100000, 65000)).toBe(35);
    expect(savingsRate(0, 1000)).toBe(0);
  });
});
