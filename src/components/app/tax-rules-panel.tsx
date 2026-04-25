"use client";

import { useState } from "react";
import type { Currency } from "@prisma/client";
import { formatMoney } from "@/lib/finance/money";

type Props = {
  rules: unknown;
  currency: Currency;
  title?: string;
};

const KNOWN_KEYS = [
  "mainRate",
  "smallProfitsRate",
  "marginalReliefFraction",
  "lowerProfitsLimit",
  "upperProfitsLimit",
  "vatThreshold",
  "serviceRate",
  "commerceRate",
  "vatRegistered",
  "vatThresholdUsage",
] as const;

type KnownKey = (typeof KNOWN_KEYS)[number];

const LABELS: Record<KnownKey, string> = {
  mainRate: "Main rate",
  smallProfitsRate: "Small profits rate",
  marginalReliefFraction: "Marginal relief fraction",
  lowerProfitsLimit: "Lower profits limit",
  upperProfitsLimit: "Upper profits limit",
  vatThreshold: "VAT threshold",
  serviceRate: "Service rate",
  commerceRate: "Commerce rate",
  vatRegistered: "VAT registered",
  vatThresholdUsage: "VAT threshold usage",
};

const PERCENT_KEYS = new Set<KnownKey>([
  "mainRate",
  "smallProfitsRate",
  "marginalReliefFraction",
  "serviceRate",
  "commerceRate",
  "vatThresholdUsage",
]);

const MONEY_KEYS = new Set<KnownKey>(["lowerProfitsLimit", "upperProfitsLimit", "vatThreshold"]);

function formatPercent(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  // Heuristic: rate values such as 0.19 represent 19%. Values >= 1 (e.g. 19) treat as already-percent.
  const pct = Math.abs(n) <= 1 ? n * 100 : n;
  return `${pct.toFixed(pct % 1 === 0 ? 0 : 2)}%`;
}

function formatBoolean(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  return String(value);
}

function formatValue(key: KnownKey, value: unknown, currency: Currency) {
  if (PERCENT_KEYS.has(key)) return formatPercent(value);
  if (MONEY_KEYS.has(key)) {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n)) {
      // The values stored are already in major units (e.g. 90000 GBP), so multiply to cents.
      return formatMoney(Math.round(n * 100), currency);
    }
    return String(value);
  }
  if (key === "vatRegistered") return formatBoolean(value);
  return String(value);
}

export function TaxRulesPanel({ rules, currency, title }: Props) {
  const [showOther, setShowOther] = useState(false);
  const record = (rules && typeof rules === "object" ? (rules as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;
  const knownEntries = KNOWN_KEYS.filter((key) => key in record).map((key) => [key, record[key]] as const);
  const otherEntries = Object.entries(record).filter(
    ([key]) => !(KNOWN_KEYS as readonly string[]).includes(key),
  );

  if (knownEntries.length === 0 && otherEntries.length === 0) {
    return <p className="text-xs text-muted-ledger">No rules data.</p>;
  }

  return (
    <div className="grid gap-1.5">
      {title ? <p className="text-xs font-semibold text-muted-ledger">{title}</p> : null}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {knownEntries.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-muted-ledger">{LABELS[key as KnownKey]}</dt>
            <dd className="text-foreground">{formatValue(key as KnownKey, value, currency)}</dd>
          </div>
        ))}
      </dl>
      {otherEntries.length > 0 ? (
        <details
          open={showOther}
          onToggle={(event) => setShowOther((event.target as HTMLDetailsElement).open)}
          className="mt-1 rounded border border-ledger-border bg-background/40 p-2"
        >
          <summary className="cursor-pointer text-[11px] text-muted-ledger">
            {otherEntries.length} other field{otherEntries.length === 1 ? "" : "s"}
          </summary>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
            {otherEntries.map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-muted-ledger">{key}</dt>
                <dd className="text-foreground break-all">
                  {typeof value === "object" ? JSON.stringify(value) : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </div>
  );
}
