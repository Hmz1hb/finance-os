import type { Currency, Receivable, RecurringRule } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { nextRecurringRuleDate } from "@/lib/finance/recurrence";
import { contextForEntityType } from "@/lib/server/entities";
import { getMadRate } from "@/lib/server/rates";
import { HttpError } from "@/lib/server/errors";

export async function createExpectedIncomeFromRule(rule: RecurringRule) {
  const rate = await getMadRate(rule.currency);
  return prisma.expectedIncome.create({
    data: {
      entityId: rule.entityId,
      recurringRuleId: rule.id,
      dueDate: rule.nextDueDate,
      amountCents: rule.amountCents,
      currency: rule.currency,
      exchangeRateSnapshot: rate,
      madEquivalentCents: Math.round(rule.amountCents * rate),
      counterparty: rule.counterparty,
      description: rule.title,
      notes: rule.notes,
    },
  });
}

export async function advanceRecurringRule(rule: RecurringRule) {
  const nextDueDate = nextRecurringRuleDate(rule.nextDueDate, rule);
  return prisma.recurringRule.update({
    where: { id: rule.id },
    data: { nextDueDate },
  });
}

export async function createRecurringRule(input: {
  entityId: string;
  title: string;
  ruleType?: "EXPECTED_INCOME" | "EXPECTED_EXPENSE" | "RECEIVABLE" | "SUBSCRIPTION" | "OWNER_PAY";
  cadence: RecurringRule["cadence"];
  intervalDays?: number | null;
  dayOfMonth?: number | null;
  secondDayOfMonth?: number | null;
  startDate: Date;
  endDate?: Date | null;
  amount: string | number;
  currency: Currency;
  counterparty?: string | null;
  autoCreate?: boolean;
  notes?: string | null;
}) {
  const rule = await prisma.recurringRule.create({
    data: {
      entityId: input.entityId,
      title: input.title,
      ruleType: input.ruleType ?? "EXPECTED_INCOME",
      cadence: input.cadence,
      intervalDays: input.intervalDays ?? undefined,
      dayOfMonth: input.dayOfMonth ?? undefined,
      secondDayOfMonth: input.secondDayOfMonth ?? undefined,
      startDate: input.startDate,
      nextDueDate: input.startDate,
      endDate: input.endDate ?? undefined,
      amountCents: toCents(input.amount),
      currency: input.currency,
      counterparty: input.counterparty ?? undefined,
      autoCreate: input.autoCreate ?? false,
      notes: input.notes ?? undefined,
    },
  });

  const expectedIncome = rule.ruleType === "EXPECTED_INCOME" ? await createExpectedIncomeFromRule(rule) : null;
  return { rule, expectedIncome };
}

export async function settleExpectedIncome(input: {
  id: string;
  date?: Date;
  amount?: string | number;
  notes?: string | null;
}) {
  const expected = await prisma.expectedIncome.findUnique({
    where: { id: input.id },
    include: { entity: true },
  });
  if (!expected) throw new HttpError(404, "Expected income not found");
  if (expected.status === "SETTLED") {
    throw new HttpError(409, "Expected income is already settled");
  }
  if (expected.status === "CANCELLED") {
    throw new HttpError(409, "Expected income is cancelled");
  }
  const amountCents = input.amount === undefined ? expected.amountCents : toCents(input.amount);
  const rate = await getMadRate(expected.currency);
  const groupId = crypto.randomUUID();

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        entityId: expected.entityId,
        date: input.date ?? new Date(),
        kind: "INCOME",
        context: contextForEntityType(expected.entity.type),
        amountCents,
        currency: expected.currency,
        exchangeRateSnapshot: rate,
        madEquivalentCents: Math.round(amountCents * rate),
        description: expected.description,
        counterparty: expected.counterparty,
        source: "Expected income settlement",
        status: "cleared",
        transactionGroupId: groupId,
        notes: input.notes ?? expected.notes,
      },
    });

    const updated = await tx.expectedIncome.update({
      where: { id: expected.id },
      data: { status: "SETTLED", transactionId: transaction.id, settledAt: transaction.date },
    });

    if (expected.recurringRuleId) {
      const rule = await tx.recurringRule.findUnique({ where: { id: expected.recurringRuleId } });
      if (rule) {
        await tx.recurringRule.update({
          where: { id: rule.id },
          data: { nextDueDate: nextRecurringRuleDate(rule.nextDueDate, rule) },
        });
      }
    }

    return { expectedIncome: updated, transaction };
  });
}

export function receivableStatus(receivable: Pick<Receivable, "amountCents" | "paidAmountCents" | "dueDate" | "status">) {
  if (receivable.status === "DISPUTED" || receivable.status === "CANCELLED") return receivable.status;
  if (receivable.paidAmountCents >= receivable.amountCents) return "PAID";
  if (receivable.paidAmountCents > 0) return "PARTIAL";
  if (receivable.dueDate && receivable.dueDate < new Date()) return "OVERDUE";
  return "OPEN";
}

export async function createReceivable(input: {
  entityId: string;
  kind: Receivable["kind"];
  counterparty: string;
  title: string;
  issueDate: Date;
  dueDate?: Date | null;
  amount: string | number;
  currency: Currency;
  source?: string | null;
  notes?: string | null;
}) {
  const amountCents = toCents(input.amount);
  const rate = await getMadRate(input.currency);
  const receivable = await prisma.receivable.create({
    data: {
      entityId: input.entityId,
      kind: input.kind,
      counterparty: input.counterparty,
      title: input.title,
      issueDate: input.issueDate,
      dueDate: input.dueDate ?? undefined,
      amountCents,
      currency: input.currency,
      exchangeRateSnapshot: rate,
      madEquivalentCents: Math.round(amountCents * rate),
      source: input.source ?? undefined,
      notes: input.notes ?? undefined,
    },
  });

  if (receivable.dueDate) {
    await prisma.expectedIncome.create({
      data: {
        entityId: receivable.entityId,
        receivableId: receivable.id,
        dueDate: receivable.dueDate,
        amountCents: receivable.amountCents,
        currency: receivable.currency,
        exchangeRateSnapshot: receivable.exchangeRateSnapshot,
        madEquivalentCents: receivable.madEquivalentCents,
        counterparty: receivable.counterparty,
        description: receivable.title,
        notes: receivable.notes,
      },
    });
  }

  return receivable;
}

export async function addReceivablePayment(input: {
  receivableId: string;
  date: Date;
  amount: string | number;
  notes?: string | null;
}) {
  const receivable = await prisma.receivable.findUniqueOrThrow({ where: { id: input.receivableId }, include: { entity: true } });
  const amountCents = toCents(input.amount);
  const rate = await getMadRate(receivable.currency);

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        entityId: receivable.entityId,
        date: input.date,
        kind: "INCOME",
        context: contextForEntityType(receivable.entity.type),
        amountCents,
        currency: receivable.currency,
        exchangeRateSnapshot: rate,
        madEquivalentCents: Math.round(amountCents * rate),
        description: `Receivable payment - ${receivable.title}`,
        counterparty: receivable.counterparty,
        source: "Receivable",
        status: "cleared",
        notes: input.notes ?? undefined,
      },
    });
    const payment = await tx.receivablePayment.create({
      data: {
        receivableId: receivable.id,
        transactionId: transaction.id,
        date: input.date,
        amountCents,
        currency: receivable.currency,
        exchangeRateSnapshot: rate,
        madEquivalentCents: Math.round(amountCents * rate),
        notes: input.notes ?? undefined,
      },
    });
    const paidAmountCents = receivable.paidAmountCents + amountCents;
    const status = receivableStatus({ ...receivable, paidAmountCents });
    const updated = await tx.receivable.update({
      where: { id: receivable.id },
      data: { paidAmountCents, status },
    });
    if (status === "PAID") {
      await tx.expectedIncome.updateMany({
        where: { receivableId: receivable.id, status: { in: ["FORECAST", "DUE"] } },
        data: { status: "SETTLED", transactionId: transaction.id, settledAt: input.date },
      });
    }
    return { receivable: updated, payment, transaction };
  });
}
