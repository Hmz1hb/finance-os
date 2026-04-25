import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import type { RecurrenceFrequency, RecurringTemplate } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { getMadRate } from "@/lib/server/rates";

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
  const templates = await prisma.recurringTemplate.findMany({
    where: { deletedAt: null, autoGenerate: true, nextDueDate: { lte: now } },
    take: limit,
  });

  const created = [];
  for (const template of templates) {
    created.push(await createRecurringTransaction(template));
  }

  return created;
}

async function createRecurringTransaction(template: RecurringTemplate) {
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
