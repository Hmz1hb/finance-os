import { Currency, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";

const supportedCurrencies = [Currency.MAD, Currency.GBP, Currency.USD, Currency.EUR] as const;
// Frankfurter (ECB-backed) does not list MAD, so we use open.er-api.com which covers it and needs no key.
const ratesApiUrl = "https://open.er-api.com/v6/latest/GBP";
const ratesSource = "open-er-api";

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isFresh(date: Date, hours = 24) {
  return Date.now() - date.getTime() < hours * 60 * 60 * 1000;
}

export async function getLatestRates() {
  const newest = await prisma.exchangeRate.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  if (newest && isFresh(newest.updatedAt)) {
    return getRateMatrixFromDb();
  }

  return refreshExchangeRates().catch(() => getRateMatrixFromDb());
}

export async function getRateMatrixFromDb() {
  const rates = await prisma.exchangeRate.findMany({
    orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
  });
  const latest = new Map<string, { rate: number; updatedAt: Date; source: string; isManual: boolean }>();

  for (const rate of rates) {
    const key = `${rate.baseCurrency}:${rate.targetCurrency}`;
    if (!latest.has(key)) {
      latest.set(key, {
        rate: Number(rate.rate),
        updatedAt: rate.updatedAt,
        source: rate.source,
        isManual: rate.isManual,
      });
    }
  }

  for (const currency of supportedCurrencies) {
    latest.set(`${currency}:${currency}`, {
      rate: 1,
      updatedAt: new Date(),
      source: "system",
      isManual: false,
    });
  }

  return latest;
}

export async function refreshExchangeRates() {
  const response = await fetch(ratesApiUrl, { next: { revalidate: 60 * 60 * 24 } });
  if (!response.ok) {
    throw new Error(`Exchange rates API failed with ${response.status}`);
  }
  const payload = (await response.json()) as {
    result?: string;
    time_last_update_unix?: number;
    rates?: Record<string, number>;
  };
  if (payload.result && payload.result !== "success") {
    throw new Error(`Exchange rates API returned result=${payload.result}`);
  }
  const rates = payload.rates ?? {};
  const gbpToMad = rates.MAD;
  const gbpToUsd = rates.USD;
  const gbpToEur = rates.EUR;
  if (!gbpToMad || !gbpToUsd || !gbpToEur) {
    throw new Error("Exchange rates API response missing GBP→MAD/USD/EUR");
  }
  const date = startOfUtcDay(
    payload.time_last_update_unix ? new Date(payload.time_last_update_unix * 1000) : new Date(),
  );

  const entries: Array<{ baseCurrency: Currency; targetCurrency: Currency; rate: number }> = [
    { baseCurrency: Currency.GBP, targetCurrency: Currency.MAD, rate: gbpToMad },
    { baseCurrency: Currency.MAD, targetCurrency: Currency.GBP, rate: 1 / gbpToMad },
    { baseCurrency: Currency.USD, targetCurrency: Currency.MAD, rate: gbpToMad / gbpToUsd },
    { baseCurrency: Currency.EUR, targetCurrency: Currency.MAD, rate: gbpToMad / gbpToEur },
    { baseCurrency: Currency.MAD, targetCurrency: Currency.USD, rate: gbpToUsd / gbpToMad },
    { baseCurrency: Currency.MAD, targetCurrency: Currency.EUR, rate: gbpToEur / gbpToMad },
    { baseCurrency: Currency.GBP, targetCurrency: Currency.USD, rate: gbpToUsd },
    { baseCurrency: Currency.USD, targetCurrency: Currency.GBP, rate: 1 / gbpToUsd },
    { baseCurrency: Currency.GBP, targetCurrency: Currency.EUR, rate: gbpToEur },
    { baseCurrency: Currency.EUR, targetCurrency: Currency.GBP, rate: 1 / gbpToEur },
    { baseCurrency: Currency.USD, targetCurrency: Currency.EUR, rate: gbpToEur / gbpToUsd },
    { baseCurrency: Currency.EUR, targetCurrency: Currency.USD, rate: gbpToUsd / gbpToEur },
    { baseCurrency: Currency.MAD, targetCurrency: Currency.MAD, rate: 1 },
    { baseCurrency: Currency.GBP, targetCurrency: Currency.GBP, rate: 1 },
    { baseCurrency: Currency.USD, targetCurrency: Currency.USD, rate: 1 },
    { baseCurrency: Currency.EUR, targetCurrency: Currency.EUR, rate: 1 },
  ];

  await prisma.$transaction(
    entries.map((entry) =>
      prisma.exchangeRate.upsert({
        where: {
          date_baseCurrency_targetCurrency: {
            date,
            baseCurrency: entry.baseCurrency,
            targetCurrency: entry.targetCurrency,
          },
        },
        create: { ...entry, date, rate: entry.rate, source: ratesSource },
        update: { rate: entry.rate, source: ratesSource, isManual: false },
      }),
    ),
  );

  return getRateMatrixFromDb();
}

export async function getMadRate(currency: Currency) {
  if (currency === Currency.MAD) return 1;
  const matrix = await getLatestRates();
  const direct = matrix.get(`${currency}:MAD`);
  if (!direct) throw new Error(`No cached ${currency} to MAD exchange rate found`);
  return direct.rate;
}

export async function setManualRate(input: {
  baseCurrency: Currency;
  targetCurrency: Currency;
  rate: Prisma.Decimal | number;
  date?: Date;
}) {
  const date = startOfUtcDay(input.date);
  return prisma.exchangeRate.upsert({
    where: {
      date_baseCurrency_targetCurrency: {
        date,
        baseCurrency: input.baseCurrency,
        targetCurrency: input.targetCurrency,
      },
    },
    create: {
      date,
      baseCurrency: input.baseCurrency,
      targetCurrency: input.targetCurrency,
      rate: input.rate,
      source: "manual",
      isManual: true,
    },
    update: { rate: input.rate, source: "manual", isManual: true },
  });
}

export async function rateSummary() {
  const matrix = await getLatestRates();
  const rates = [...matrix.entries()]
    .filter(([key]) => key.endsWith(":MAD"))
    .map(([pair, value]) => ({ pair, ...value }));
  const lastUpdated = rates.reduce<Date | null>(
    (latest, rate) => (!latest || rate.updatedAt > latest ? rate.updatedAt : latest),
    null,
  );
  return { rates, lastUpdated };
}
