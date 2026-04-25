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

const madFormatter = new Intl.NumberFormat("fr-MA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

const currencyFormatters: Partial<Record<Currency, Intl.NumberFormat>> = {
  GBP: new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  USD: new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  EUR: new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
};

export function formatMoney(amountCents: number, currency: Currency) {
  const amount = amountCents / 100;
  if (currency === "MAD") {
    return `${madFormatter.format(amount)} ${currencySymbols.MAD}`;
  }
  const formatter = currencyFormatters[currency];
  if (formatter) return formatter.format(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMad(amountCents: number) {
  return formatMoney(amountCents, "MAD");
}

export function convertToMad(amountCents: number, exchangeRate: number) {
  return Math.round(amountCents * exchangeRate);
}

export function savingsRate(incomeCents: number, expenseCents: number) {
  if (incomeCents <= 0) return 0;
  return Math.round(((incomeCents - expenseCents) / incomeCents) * 100);
}
