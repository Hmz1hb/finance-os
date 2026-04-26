import { addDays } from "date-fns";
import type { Currency, Prisma } from "@prisma/client";
import { RecurringRuleType } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { listEntities } from "@/lib/server/entities";
import { getMadRate } from "@/lib/server/rates";

function expectedIncomeWindow(now: Date) {
  return { gte: now, lte: addDays(now, 30) };
}

async function cashBalanceCents(prismaWhere: Prisma.TransactionWhereInput) {
  const [income, expenses] = await Promise.all([
    prisma.transaction.aggregate({
      where: { ...prismaWhere, kind: "INCOME", deletedAt: null },
      _sum: { madEquivalentCents: true },
    }),
    prisma.transaction.aggregate({
      where: { ...prismaWhere, kind: "EXPENSE", deletedAt: null },
      _sum: { madEquivalentCents: true },
    }),
  ]);
  return (income._sum.madEquivalentCents ?? 0) - (expenses._sum.madEquivalentCents ?? 0);
}

// Convert a MAD-cents amount into the target currency's cents using the cached
// rate matrix. Returns the same number unchanged when the target is MAD or when
// the rate matrix isn't seeded yet (falls back gracefully so the page still renders).
async function madToCurrencyCents(madCents: number, currency: Currency) {
  if (currency === "MAD") return madCents;
  const rate = await getMadRate(currency).catch(() => 0); // currency -> MAD
  if (!rate) return madCents;
  return Math.round(madCents / rate);
}

export async function entityRailSummary() {
  const entities = await listEntities();
  const now = new Date();
  const window = expectedIncomeWindow(now);

  const rows = await Promise.all(
    entities.map(async (entity) => {
      const [cashCents, expected, overdueReceivables, taxReserve] = await Promise.all([
        // Match cockpitSummary's cashBalanceCents window so EntityRail "Combined"
        // and Cockpit "Cash now" agree on baseline. Future-dated (scheduled)
        // transactions must not inflate the cash position. (QA L903 / L1040.)
        cashBalanceCents({ entityId: entity.id, date: { lte: now } }),
        prisma.expectedIncome.aggregate({
          where: { entityId: entity.id, status: { in: ["FORECAST", "DUE"] }, dueDate: window },
          _sum: { madEquivalentCents: true },
        }),
        prisma.receivable.aggregate({
          where: { entityId: entity.id, deletedAt: null, status: { in: ["OPEN", "PARTIAL", "OVERDUE"] }, dueDate: { lt: now } },
          _sum: { madEquivalentCents: true, paidAmountCents: true },
          _count: true,
        }),
        prisma.taxReserve.aggregate({
          where: { entityId: entity.id, status: { in: ["SUGGESTED", "RESERVED"] } },
          _sum: { reserveCents: true },
        }),
      ]);

      return {
        entity,
        cashCents,
        expectedCents: expected._sum.madEquivalentCents ?? 0,
        overdueReceivableCents: (overdueReceivables._sum.madEquivalentCents ?? 0) - (overdueReceivables._sum.paidAmountCents ?? 0),
        overdueReceivableCount: overdueReceivables._count,
        taxReserveCents: taxReserve._sum.reserveCents ?? 0,
      };
    }),
  );

  return rows;
}

export async function cockpitSummary(entityId?: string) {
  const now = new Date();
  const window = expectedIncomeWindow(now);
  const whereEntity = entityId ? { entityId } : {};

  const [cashCents, transactions, expectedIncome, receivables, reserves, ownerPay, recurringRules, entities] = await Promise.all([
    // L208 fix: "Cash now" should not include future-dated (scheduled) transactions —
    // only postings dated <= now count toward the actual cash position.
    cashBalanceCents({ ...whereEntity, date: { lte: now } }),
    prisma.transaction.findMany({
      where: { ...whereEntity, deletedAt: null },
      include: { entity: true, category: true },
      orderBy: { date: "desc" },
      take: 12,
    }),
    prisma.expectedIncome.findMany({
      where: { ...whereEntity, status: { in: ["FORECAST", "DUE"] }, dueDate: window },
      include: { entity: true },
      orderBy: { dueDate: "asc" },
      take: 12,
    }),
    prisma.receivable.findMany({
      where: { ...whereEntity, deletedAt: null, status: { in: ["OPEN", "PARTIAL", "OVERDUE", "DISPUTED"] } },
      include: { entity: true, payments: true },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 12,
    }),
    prisma.taxReserve.findMany({
      where: { ...whereEntity, status: { in: ["SUGGESTED", "RESERVED"] } },
      include: { entity: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.ownerCompensation.findMany({
      where: entityId ? { OR: [{ fromEntityId: entityId }, { toEntityId: entityId }] } : {},
      include: { fromEntity: true, toEntity: true },
      orderBy: { date: "desc" },
      take: 8,
    }),
    prisma.recurringRule.findMany({
      where: {
        ...whereEntity,
        deletedAt: null,
        ruleType: { in: [RecurringRuleType.EXPECTED_EXPENSE, RecurringRuleType.SUBSCRIPTION, RecurringRuleType.OWNER_PAY] },
      },
      include: { entity: true },
      orderBy: { nextDueDate: "asc" },
      take: 8,
    }),
    listEntities(),
  ]);

  const receivableOpenCents = receivables.reduce((sum, item) => sum + Math.max(0, item.madEquivalentCents - item.paidAmountCents), 0);
  const overdueReceivableCount = receivables.filter((item) => item.dueDate && item.dueDate < now).length;

  const expectedIncomeCents = expectedIncome.reduce((sum, item) => sum + item.madEquivalentCents, 0);
  const taxReserveCents = reserves.reduce((sum, item) => sum + item.reserveCents, 0);

  // L159 fix: when a single entity is selected, the cockpit should be presented in
  // that entity's base currency, not MAD. We keep all upstream maths in MAD and
  // convert the four headline aggregates back into the entity-base-currency cents
  // here. Combined view stays in MAD.
  const activeEntity = entityId ? entities.find((entity) => entity.id === entityId) : null;
  const displayCurrency: Currency = activeEntity?.baseCurrency ?? "MAD";
  const [cashCentsDisplay, expectedIncomeCentsDisplay, receivableOpenCentsDisplay, taxReserveCentsDisplay] = await Promise.all([
    madToCurrencyCents(cashCents, displayCurrency),
    madToCurrencyCents(expectedIncomeCents, displayCurrency),
    madToCurrencyCents(receivableOpenCents, displayCurrency),
    madToCurrencyCents(taxReserveCents, displayCurrency),
  ]);

  return {
    entities,
    displayCurrency,
    cashCents: cashCentsDisplay,
    expectedIncomeCents: expectedIncomeCentsDisplay,
    receivableOpenCents: receivableOpenCentsDisplay,
    overdueReceivableCount,
    taxReserveCents: taxReserveCentsDisplay,
    // Raw MAD totals are kept available for callers (e.g. tests / health-score)
    // that need the entity-agnostic baseline.
    cashCentsMad: cashCents,
    expectedIncomeCentsMad: expectedIncomeCents,
    receivableOpenCentsMad: receivableOpenCents,
    taxReserveCentsMad: taxReserveCents,
    transactions,
    expectedIncome,
    receivables,
    reserves,
    ownerPay,
    recurringRules,
  };
}
