import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Currency, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { getMadRate } from "@/lib/server/rates";
import { contextForEntityType } from "@/lib/server/entities";
import { HttpError, jsonError, parseJson, requireSession } from "@/lib/server/http";

const MAX_PAY_CENTS = 100_000_000;

const schema = z.object({
  date: z.coerce.date(),
  amount: z
    .union([z.string(), z.number()])
    .refine((value) => {
      const numeric = Number(typeof value === "string" ? value.replace(/,/g, "") : value);
      return Number.isFinite(numeric) && numeric > 0 && Math.round(numeric * 100) <= MAX_PAY_CENTS;
    }, { message: "Amount must be > 0 and <= 1,000,000" }),
  currency: z.enum(Currency),
  paymentType: z.enum(["salary", "dividend", "drawings"]),
  notes: z.string().optional(),
  fromEntityId: z.string().min(1),
  toEntityId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const parsed = await parseJson(request, schema);

    const [fromEntity, toEntity] = await Promise.all([
      prisma.financialEntity.findUnique({ where: { id: parsed.fromEntityId } }),
      prisma.financialEntity.findUnique({ where: { id: parsed.toEntityId } }),
    ]);
    if (!fromEntity) throw new HttpError(400, `Unknown fromEntityId: ${parsed.fromEntityId}`);
    if (!toEntity) throw new HttpError(400, `Unknown toEntityId: ${parsed.toEntityId}`);

    const amountCents = toCents(parsed.amount);
    const rate = await getMadRate(parsed.currency);
    const madEquivalentCents = Math.round(amountCents * rate);
    const groupId = crypto.randomUUID();

    const [businessExpense, personalIncome] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          entityId: fromEntity.id,
          date: parsed.date,
          kind: TransactionType.EXPENSE,
          context: contextForEntityType(fromEntity.type),
          amountCents,
          currency: parsed.currency,
          exchangeRateSnapshot: rate,
          madEquivalentCents,
          description: `Pay myself - ${parsed.paymentType}`,
          source: "Owner payroll",
          status: "pending",
          transactionGroupId: groupId,
          notes: parsed.notes,
        },
      }),
      prisma.transaction.create({
        data: {
          entityId: toEntity.id,
          date: parsed.date,
          kind: TransactionType.INCOME,
          context: contextForEntityType(toEntity.type),
          amountCents,
          currency: parsed.currency,
          exchangeRateSnapshot: rate,
          madEquivalentCents,
          description: `Business pay - ${parsed.paymentType}`,
          source: "Business",
          status: "pending",
          transactionGroupId: groupId,
          notes: parsed.notes,
        },
      }),
    ]);

    const self = await prisma.payrollPerson.upsert({
      where: { id: "self" },
      create: {
        id: "self",
        name: "Owner",
        role: "Founder",
        paymentFrequency: "MONTHLY",
        rateCents: 0,
        currency: parsed.currency,
        isSelf: true,
      },
      update: { isSelf: true },
    });

    const payment = await prisma.payrollPayment.create({
      data: {
        personId: self.id,
        date: parsed.date,
        amountCents,
        currency: parsed.currency,
        exchangeRateSnapshot: rate,
        madEquivalentCents,
        paymentType: parsed.paymentType,
        businessTransactionId: businessExpense.id,
        personalTransactionId: personalIncome.id,
        notes: parsed.notes,
      },
    });

    return NextResponse.json({ payment, businessExpense, personalIncome });
  } catch (error) {
    return jsonError(error);
  }
}
