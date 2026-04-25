import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ContextMode, Currency, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { getMadRate } from "@/lib/server/rates";
import { jsonError, requireSession } from "@/lib/server/http";

const schema = z.object({
  date: z.coerce.date(),
  amount: z.union([z.string(), z.number()]),
  currency: z.enum(Currency),
  paymentType: z.enum(["salary", "dividend", "drawings"]),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const parsed = schema.parse(await request.json());
    const amountCents = toCents(parsed.amount);
    const rate = await getMadRate(parsed.currency);
    const madEquivalentCents = Math.round(amountCents * rate);
    const groupId = crypto.randomUUID();

    const [businessExpense, personalIncome] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          date: parsed.date,
          kind: TransactionType.EXPENSE,
          context: ContextMode.BUSINESS,
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
          date: parsed.date,
          kind: TransactionType.INCOME,
          context: ContextMode.PERSONAL,
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
