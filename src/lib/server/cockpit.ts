import { addDays } from "date-fns";
import { prisma } from "@/lib/server/db";
import { listEntities } from "@/lib/server/entities";

export async function entityRailSummary() {
  const entities = await listEntities();
  const now = new Date();
  const soon = addDays(now, 30);

  const rows = await Promise.all(
    entities.map(async (entity) => {
      const [income, expenses, expected, overdueReceivables, taxReserve] = await Promise.all([
        prisma.transaction.aggregate({
          where: { entityId: entity.id, kind: "INCOME", deletedAt: null },
          _sum: { madEquivalentCents: true },
        }),
        prisma.transaction.aggregate({
          where: { entityId: entity.id, kind: "EXPENSE", deletedAt: null },
          _sum: { madEquivalentCents: true },
        }),
        prisma.expectedIncome.aggregate({
          where: { entityId: entity.id, status: { in: ["FORECAST", "DUE"] }, dueDate: { gte: now, lte: soon } },
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
        cashCents: (income._sum.madEquivalentCents ?? 0) - (expenses._sum.madEquivalentCents ?? 0),
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
  const soon = addDays(now, 30);
  const whereEntity = entityId ? { entityId } : {};

  const [transactions, expectedIncome, receivables, reserves, ownerPay, recurringRules, entities] = await Promise.all([
    prisma.transaction.findMany({
      where: { ...whereEntity, deletedAt: null },
      include: { entity: true, category: true },
      orderBy: { date: "desc" },
      take: 12,
    }),
    prisma.expectedIncome.findMany({
      where: { ...whereEntity, status: { in: ["FORECAST", "DUE"] }, dueDate: { lte: soon } },
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
      where: { ...whereEntity, deletedAt: null },
      include: { entity: true },
      orderBy: { nextDueDate: "asc" },
      take: 8,
    }),
    listEntities(),
  ]);

  const incomeCents = transactions.filter((item) => item.kind === "INCOME").reduce((sum, item) => sum + item.madEquivalentCents, 0);
  const expenseCents = transactions.filter((item) => item.kind === "EXPENSE").reduce((sum, item) => sum + item.madEquivalentCents, 0);
  const receivableOpenCents = receivables.reduce((sum, item) => sum + Math.max(0, item.madEquivalentCents - item.paidAmountCents), 0);
  const overdueReceivableCount = receivables.filter((item) => item.dueDate && item.dueDate < now).length;

  return {
    entities,
    cashCents: incomeCents - expenseCents,
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
