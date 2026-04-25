import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import type { RecurrenceFrequency, RecurringRule, RecurringTemplate } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { getMadRate } from "@/lib/server/rates";
import { nextRecurringRuleDate } from "@/lib/finance/recurrence";
import { contextForEntityType } from "@/lib/server/entities";
import { createExpectedIncomeFromRule } from "@/lib/server/cashflows";

export function nextDate(date: Date, frequency: RecurrenceFrequency) {
  switch (frequency) {
    case "DAILY":
      return addDays(date, 1);
    case "WEEKLY":
      return addWeeks(date, 1);
    case "BIWEEKLY":
      return addWeeks(date, 2);
    case "MONTHLY":
      return addMonths(date, 1);
    case "QUARTERLY":
      return addMonths(date, 3);
    case "YEARLY":
      return addYears(date, 1);
  }
}

export async function generateRecurringInstances(limit = 25) {
  const now = new Date();
  const rules = await prisma.recurringRule.findMany({
    where: { deletedAt: null, autoCreate: true, nextDueDate: { lte: now } },
    take: limit,
  });

  const created: Array<{ ruleId: string; kind: string; id: string }> = [];

  for (const rule of rules) {
    const instance = await processRecurringRule(rule);
    if (instance) created.push(instance);
  }

  return { created };
}

async function processRecurringRule(rule: RecurringRule): Promise<{ ruleId: string; kind: string; id: string } | null> {
  let result: { ruleId: string; kind: string; id: string } | null = null;

  switch (rule.ruleType) {
    case "EXPECTED_INCOME":
    case "RECEIVABLE": {
      const expected = await createExpectedIncomeFromRule(rule);
      result = { ruleId: rule.id, kind: "expectedIncome", id: expected.id };
      break;
    }
    case "EXPECTED_EXPENSE":
    case "SUBSCRIPTION":
    case "OWNER_PAY": {
      const transaction = await createExpenseTransactionFromRule(rule);
      if (transaction) {
        result = { ruleId: rule.id, kind: "transaction", id: transaction.id };
      }
      break;
    }
  }

  const nextDueDate = nextRecurringRuleDate(rule.nextDueDate, rule);
  const shouldRetire = rule.endDate ? nextDueDate > rule.endDate : false;
  await prisma.recurringRule.update({
    where: { id: rule.id },
    data: {
      nextDueDate,
      ...(shouldRetire ? { deletedAt: new Date() } : {}),
    },
  });

  return result;
}

async function createExpenseTransactionFromRule(rule: RecurringRule) {
  const entity = await prisma.financialEntity.findUnique({ where: { id: rule.entityId } });
  if (!entity) return null;
  const rate = await getMadRate(rule.currency);
  return prisma.transaction.create({
    data: {
      entityId: rule.entityId,
      date: rule.nextDueDate,
      kind: "EXPENSE",
      context: contextForEntityType(entity.type),
      amountCents: rule.amountCents,
      currency: rule.currency,
      exchangeRateSnapshot: rate,
      madEquivalentCents: Math.round(rule.amountCents * rate),
      categoryId: rule.categoryId ?? undefined,
      description: rule.title,
      counterparty: rule.counterparty,
      isRecurring: true,
      status: "pending",
      notes: rule.notes,
    },
  });
}

// Legacy helper retained for backwards compatibility with the older RecurringTemplate flow.
export async function createRecurringTransaction(template: RecurringTemplate) {
  const rate = await getMadRate(template.currency);
  const transaction = await prisma.transaction.create({
    data: {
      date: template.nextDueDate,
      kind: template.kind,
      context: template.context,
      amountCents: template.amountCents,
      currency: template.currency,
      exchangeRateSnapshot: rate,
      madEquivalentCents: Math.round(template.amountCents * rate),
      categoryId: template.categoryId,
      description: template.title,
      counterparty: template.vendor,
      paymentMethod: template.paymentMethod,
      isRecurring: true,
      recurringTemplateId: template.id,
      status: "pending",
      notes: template.notes,
    },
  });

  await prisma.recurringTemplate.update({
    where: { id: template.id },
    data: { nextDueDate: nextDate(template.nextDueDate, template.frequency) },
  });

  return transaction;
}
