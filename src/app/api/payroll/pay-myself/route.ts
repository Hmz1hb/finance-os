import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Currency, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { getMadRate } from "@/lib/server/rates";
import { contextForEntityType } from "@/lib/server/entities";
import { HttpError, jsonError, parseJson, requireWriteAuth } from "@/lib/server/http";

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
  fxRate: z.number().positive().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireWriteAuth(request);
    const parsed = await parseJson(request, schema);

    const [fromEntity, toEntity] = await Promise.all([
      prisma.financialEntity.findUnique({ where: { id: parsed.fromEntityId } }),
      prisma.financialEntity.findUnique({ where: { id: parsed.toEntityId } }),
    ]);
    if (!fromEntity) throw new HttpError(400, `Unknown fromEntityId: ${parsed.fromEntityId}`);
    if (!toEntity) throw new HttpError(400, `Unknown toEntityId: ${parsed.toEntityId}`);

    // Currency mismatch guard: requested currency must match at least one entity's
    // baseCurrency, OR the client must explicitly send fxRate to acknowledge FX.
    const currencyMatchesEntity =
      parsed.currency === fromEntity.baseCurrency || parsed.currency === toEntity.baseCurrency;
    if (!currencyMatchesEntity && parsed.fxRate === undefined) {
      throw new HttpError(400, "Currency does not match either entity. Send an explicit fxRate to acknowledge FX conversion.", [
        {
          path: "currency",
          message: `Expected ${fromEntity.baseCurrency} (from) or ${toEntity.baseCurrency} (to); got ${parsed.currency}.`,
        },
      ]);
    }

    const amountCents = toCents(parsed.amount);
    const rate = await getMadRate(parsed.currency);
    const madEquivalentCents = Math.round(amountCents * rate);
    const groupId = crypto.randomUUID();

    // Wallet partial-write rollback (Cluster F): all four writes — the balanced
    // EXPENSE + INCOME transactions, the payrollPerson upsert, and the
    // payrollPayment row — must be one atomic unit. The previous code wrapped
    // only steps 1-2 in `$transaction([...])` and ran steps 3-4 as bare
    // `prisma.<model>` calls afterwards, so a step-3/4 failure left the
    // balanced transaction rows committed and the Combined wallet card
    // (cockpit.ts cashBalanceCents) reflected the half-write as a real change.
    // The interactive form below rolls every step back on any thrown error.
    const result = await prisma.$transaction(async (tx) => {
      const businessExpense = await tx.transaction.create({
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
      });

      const personalIncome = await tx.transaction.create({
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
      });

      const self = await tx.payrollPerson.upsert({
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

      const payment = await tx.payrollPayment.create({
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

      return { payment, businessExpense, personalIncome };
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
