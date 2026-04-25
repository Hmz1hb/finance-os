import type { Currency } from "@prisma/client";

export const currencySymbols: Record<Currency, string> = {
  MAD: "د.م.",
  GBP: "£",
  USD: "$",
  EUR: "€",
};

export function toCents(value: string | number) {
  const normalized = typeof value === "number" ? value : Number(value.replace(/,/g, ""));
  if (!Number.isFinite(normalized)) {
    throw new Error("Invalid money amount");
  }
  return Math.round(normalized * 100);
}

export function fromCents(value: number) {
  return value / 100;
}

export function formatMoney(amountCents: number, currency: Currency = "MAD") {
  const amount = amountCents / 100;
  if (currency === "MAD") {
    return `${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)} ${currencySymbols.MAD}`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function convertToMad(amountCents: number, exchangeRate: number) {
  return Math.round(amountCents * exchangeRate);
}

export function savingsRate(incomeCents: number, expenseCents: number) {
  if (incomeCents <= 0) return 0;
  return Math.round(((incomeCents - expenseCents) / incomeCents) * 100);
}
