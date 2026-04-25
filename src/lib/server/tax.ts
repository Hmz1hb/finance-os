import { addMonths } from "date-fns";
import type { Currency, TaxProfile } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { UK_LTD_ENTITY_ID, MOROCCO_PERSONAL_ENTITY_ID } from "@/lib/server/entities";

export type UkCorporationTaxRules = {
  smallProfitsRate?: number;
  mainRate?: number;
  lowerLimitCents?: number;
  upperLimitCents?: number;
  marginalReliefFraction?: string;
  vatThresholdCents?: number;
  vatRegistered?: boolean;
};

export type MoroccoAeRules = {
  commerceRate?: number;
  serviceRate?: number;
  commerceCeilingCents?: number;
  serviceCeilingCents?: number;
  singleClientThresholdCents?: number;
  singleClientExcessRate?: number;
  vatExempt?: boolean;
  declarationCadence?: string;
};

function fractionToNumber(value?: string) {
  if (!value) return 0.015;
  const [top, bottom] = value.split("/").map(Number);
  return top && bottom ? top / bottom : 0.015;
}

export function calculateUkCorporationTax(profitCents: number, rules: UkCorporationTaxRules = {}) {
  const taxable = Math.max(0, profitCents);
  const smallRate = rules.smallProfitsRate ?? 0.19;
  const mainRate = rules.mainRate ?? 0.25;
  const lower = rules.lowerLimitCents ?? 5000000;
  const upper = rules.upperLimitCents ?? 25000000;
  const marginalFraction = fractionToNumber(rules.marginalReliefFraction);

  if (taxable <= lower) {
    return Math.round(taxable * smallRate);
  }
  if (taxable > upper) {
    return Math.round(taxable * mainRate);
  }

  const mainCharge = taxable * mainRate;
  const relief = (upper - taxable) * marginalFraction;
  return Math.max(0, Math.round(mainCharge - relief));
}

export function calculateMoroccoAeTax(
  serviceTurnoverCents: number,
  commerceTurnoverCents: number,
  rules: MoroccoAeRules = {},
) {
  const serviceRate = rules.serviceRate ?? 0.01;
  const commerceRate = rules.commerceRate ?? 0.005;
  return Math.round(Math.max(0, serviceTurnoverCents) * serviceRate + Math.max(0, commerceTurnoverCents) * commerceRate);
}

export function ukTaxYearFor(date = new Date()) {
  const year = date.getUTCMonth() > 3 || (date.getUTCMonth() === 3 && date.getUTCDate() >= 6)
    ? date.getUTCFullYear()
    : date.getUTCFullYear() - 1;
  return {
    start: new Date(Date.UTC(year, 3, 6)),
    end: new Date(Date.UTC(year + 1, 3, 5, 23, 59, 59, 999)),
  };
}

export function calendarYearFor(date = new Date()) {
  return {
    start: new Date(Date.UTC(date.getUTCFullYear(), 0, 1)),
    end: new Date(Date.UTC(date.getUTCFullYear(), 11, 31, 23, 59, 59, 999)),
  };
}

async function activeProfile(entityId: string) {
  return prisma.taxProfile.findFirst({
    where: { entityId, isActive: true },
    orderBy: { effectiveFrom: "desc" },
  });
}

function rulesOf<T>(profile: TaxProfile | null): T {
  return (profile?.rules ?? {}) as T;
}

export async function estimateUkLtdTax(period = ukTaxYearFor()) {
  const profile = await activeProfile(UK_LTD_ENTITY_ID);
  const rules = rulesOf<UkCorporationTaxRules>(profile);
  const [income, expenses] = await Promise.all([
    prisma.transaction.aggregate({
      where: { entityId: UK_LTD_ENTITY_ID, kind: "INCOME", deletedAt: null, date: { gte: period.start, lte: period.end } },
      _sum: { amountCents: true },
    }),
    prisma.transaction.aggregate({
      where: { entityId: UK_LTD_ENTITY_ID, kind: "EXPENSE", deletedAt: null, date: { gte: period.start, lte: period.end } },
      _sum: { amountCents: true },
    }),
  ]);
  const revenueCents = income._sum.amountCents ?? 0;
  const expenseCents = expenses._sum.amountCents ?? 0;
  const profitCents = Math.max(0, revenueCents - expenseCents);
  const estimatedTaxCents = calculateUkCorporationTax(profitCents, rules);
  const vatThresholdCents = rules.vatThresholdCents ?? 9000000;

  return {
    entityId: UK_LTD_ENTITY_ID,
    taxProfileId: profile?.id,
    periodStart: period.start,
    periodEnd: period.end,
    taxableBaseCents: profitCents,
    estimatedTaxCents,
    reserveCents: estimatedTaxCents,
    currency: "GBP" as Currency,
    assumptions: {
      kind: "UK_LTD_CORPORATION_TAX",
      revenueCents,
      expenseCents,
      vatRegistered: rules.vatRegistered ?? false,
      vatThresholdCents,
      vatThresholdUsage: vatThresholdCents > 0 ? revenueCents / vatThresholdCents : 0,
      paymentDeadline: addMonths(period.end, 9),
      filingDeadline: addMonths(period.end, 12),
      source: "Estimate only. Uses configured accounting/tax rules, not a filing.",
    },
  };
}

export async function estimateMoroccoAeTax(period = calendarYearFor()) {
  const profile = await activeProfile(MOROCCO_PERSONAL_ENTITY_ID);
  const rules = rulesOf<MoroccoAeRules>(profile);
  const rows = await prisma.transaction.findMany({
    where: {
      entityId: MOROCCO_PERSONAL_ENTITY_ID,
      kind: "INCOME",
      deletedAt: null,
      date: { gte: period.start, lte: period.end },
    },
    select: { amountCents: true, counterparty: true, source: true, tags: true },
  });
  const serviceTurnoverCents = rows.reduce((sum, row) => sum + row.amountCents, 0);
  const commerceTurnoverCents = 0;
  const estimatedTaxCents = calculateMoroccoAeTax(serviceTurnoverCents, commerceTurnoverCents, rules);
  const byClient = rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.counterparty ?? row.source ?? "Unknown";
    acc[key] = (acc[key] ?? 0) + row.amountCents;
    return acc;
  }, {});
  const singleClientThresholdCents = rules.singleClientThresholdCents ?? 8000000;
  const singleClientWarnings = Object.entries(byClient)
    .filter(([, amount]) => amount > singleClientThresholdCents)
    .map(([counterparty, amountCents]) => ({ counterparty, amountCents, excessCents: amountCents - singleClientThresholdCents }));

  return {
    entityId: MOROCCO_PERSONAL_ENTITY_ID,
    taxProfileId: profile?.id,
    periodStart: period.start,
    periodEnd: period.end,
    taxableBaseCents: serviceTurnoverCents + commerceTurnoverCents,
    estimatedTaxCents,
    reserveCents: estimatedTaxCents,
    currency: "MAD" as Currency,
    assumptions: {
      kind: "MOROCCO_AUTO_ENTREPRENEUR",
      serviceTurnoverCents,
      commerceTurnoverCents,
      serviceRate: rules.serviceRate ?? 0.01,
      commerceRate: rules.commerceRate ?? 0.005,
      serviceCeilingCents: rules.serviceCeilingCents ?? 20000000,
      commerceCeilingCents: rules.commerceCeilingCents ?? 50000000,
      vatExempt: rules.vatExempt ?? true,
      declarationCadence: rules.declarationCadence ?? "QUARTERLY",
      singleClientWarnings,
      source: "Estimate only. Rules are editable because Moroccan AE guidance has changed over time.",
    },
  };
}

export async function createTaxReserve(entityId?: string) {
  const estimate = entityId === UK_LTD_ENTITY_ID ? await estimateUkLtdTax() : await estimateMoroccoAeTax();
  return prisma.taxReserve.create({ data: estimate });
}

export async function taxCockpit() {
  const [uk, morocco, reserves] = await Promise.all([
    estimateUkLtdTax(),
    estimateMoroccoAeTax(),
    prisma.taxReserve.findMany({ include: { entity: true }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  return { uk, morocco, reserves };
}
