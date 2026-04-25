import type { Currency, OwnerCompensationType } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { MOROCCO_PERSONAL_ENTITY_ID, UK_LTD_ENTITY_ID } from "@/lib/server/entities";
import { getMadRate } from "@/lib/server/rates";

export async function createOwnerCompensation(input: {
  date: Date;
  amount: string | number;
  currency: Currency;
  paymentType: OwnerCompensationType;
  taxTreatment?: string | null;
  notes?: string | null;
  fromEntityId?: string;
  toEntityId?: string;
}) {
  const fromEntityId = input.fromEntityId ?? UK_LTD_ENTITY_ID;
  const toEntityId = input.toEntityId ?? MOROCCO_PERSONAL_ENTITY_ID;
  const amountCents = toCents(input.amount);
  const rate = await getMadRate(input.currency);
  const madEquivalentCents = Math.round(amountCents * rate);
  const groupId = crypto.randomUUID();

  return prisma.$transaction(async (tx) => {
    const businessTransaction = await tx.transaction.create({
      data: {
        entityId: fromEntityId,
        date: input.date,
        kind: "EXPENSE",
        context: "BUSINESS",
        amountCents,
        currency: input.currency,
        exchangeRateSnapshot: rate,
        madEquivalentCents,
        description: `Owner compensation - ${input.paymentType.toLowerCase().replaceAll("_", " ")}`,
        source: "Owner pay",
        status: "pending",
        transactionGroupId: groupId,
        notes: input.notes ?? undefined,
      },
    });

    const personalTransaction = await tx.transaction.create({
      data: {
        entityId: toEntityId,
        date: input.date,
        kind: "INCOME",
        context: "PERSONAL",
        amountCents,
        currency: input.currency,
        exchangeRateSnapshot: rate,
        madEquivalentCents,
        description: `Owner income - ${input.paymentType.toLowerCase().replaceAll("_", " ")}`,
        source: "UK LTD",
        status: "pending",
        transactionGroupId: groupId,
        notes: input.notes ?? undefined,
      },
    });

    const compensation = await tx.ownerCompensation.create({
      data: {
        fromEntityId,
        toEntityId,
        date: input.date,
        amountCents,
        currency: input.currency,
        exchangeRateSnapshot: rate,
        madEquivalentCents,
        paymentType: input.paymentType,
        taxTreatment: input.taxTreatment ?? defaultTaxTreatment(input.paymentType),
        businessTransactionId: businessTransaction.id,
        personalTransactionId: personalTransaction.id,
        notes: input.notes ?? undefined,
      },
    });

    return { compensation, businessTransaction, personalTransaction };
  });
}

function defaultTaxTreatment(paymentType: OwnerCompensationType) {
  switch (paymentType) {
    case "SALARY":
      return "Payroll-like salary classification. PAYE/NIC filing logic is not calculated in v1.";
    case "DIVIDEND":
      return "Dividend-style owner distribution. Check distributable profit before relying on this.";
    case "DIRECTOR_LOAN":
      return "Director loan movement. Track repayment separately.";
    case "REIMBURSEMENT":
      return "Expense reimbursement. Usually not income if backed by business receipts.";
    case "DRAWINGS":
      return "Owner drawings classification for non-LTD contexts.";
    case "OTHER":
      return "Custom owner compensation classification.";
  }
}
