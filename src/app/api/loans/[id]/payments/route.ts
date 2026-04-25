import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { getMadRate } from "@/lib/server/rates";
import { contextForEntityType } from "@/lib/server/entities";
import { HttpError, jsonError, parseJson, requireSession } from "@/lib/server/http";

const schema = z.object({
  date: z.coerce.date().default(() => new Date()),
  amount: z.union([z.string(), z.number()]),
  principal: z.union([z.string(), z.number()]).optional(),
  interest: z.union([z.string(), z.number()]).optional(),
  notes: z.string().optional().nullable(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const loan = await prisma.loan.findFirst({ where: { id, deletedAt: null }, include: { entity: true } });
    if (!loan) throw new HttpError(404, "Loan not found");
    const parsed = await parseJson(request, schema);
    const amountCents = toCents(parsed.amount);
    if (amountCents <= 0) throw new HttpError(400, "Payment amount must be positive");

    const interestCents = parsed.interest !== undefined ? toCents(parsed.interest) : 0;
    const principalCents = parsed.principal !== undefined ? toCents(parsed.principal) : amountCents - interestCents;
    if (principalCents + interestCents !== amountCents) {
      throw new HttpError(400, "Principal + interest must equal total payment amount");
    }

    const rate = await getMadRate(loan.currency);
    const madEquivalentCents = Math.round(amountCents * rate);
    const newBalanceCents = Math.max(0, loan.remainingBalanceCents - principalCents);

    return NextResponse.json(
      await prisma.$transaction(async (tx) => {
        const transaction = loan.entity
          ? await tx.transaction.create({
              data: {
                entityId: loan.entity.id,
                date: parsed.date,
                kind: "EXPENSE",
                context: contextForEntityType(loan.entity.type),
                amountCents,
                currency: loan.currency,
                exchangeRateSnapshot: rate,
                madEquivalentCents,
                description: `Loan payment - ${loan.lenderName}`,
                source: "Loan repayment",
                status: "cleared",
                notes: parsed.notes ?? undefined,
              },
            })
          : null;

        const payment = await tx.loanPayment.create({
          data: {
            loanId: loan.id,
            transactionId: transaction?.id,
            date: parsed.date,
            amountCents,
            principalCents,
            interestCents,
            currency: loan.currency,
            exchangeRateSnapshot: rate,
            madEquivalentCents,
            notes: parsed.notes ?? undefined,
          },
        });
        const updated = await tx.loan.update({
          where: { id: loan.id },
          data: { remainingBalanceCents: newBalanceCents },
        });
        return { loan: updated, payment, transaction };
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
