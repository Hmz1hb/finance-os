import { addDays } from "date-fns";
import type { Prisma } from "@prisma/client";
import { RecurringRuleType } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { listEntities } from "@/lib/server/entities";

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

export async function entityRailSummary() {
  const entities = await listEntities();
  const now = new Date();
  const window = expectedIncomeWindow(now);

  const rows = await Promise.all(
    entities.map(async (entity) => {
      const [cashCents, expected, overdueReceivables, taxReserve] = await Promise.all([
        cashBalanceCents({ entityId: entity.id }),
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
    cashBalanceCents(whereEntity),
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

  return {
    entities,
    cashCents,
    expectedIncomeCents: expectedIncome.reduce((sum, item) => sum + item.madEquivalentCents, 0),
    receivableOpenCents,
    overdueReceivableCount,
    taxReserveCents: reserves.reduce((sum, item) => sum + item.reserveCents, 0),
    transactions,
    expectedIncome,
    receivables,
    reserves,
    ownerPay,
    recurringRules,
  };
}
