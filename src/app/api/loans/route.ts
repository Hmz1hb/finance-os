import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Currency, LoanKind } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { jsonError, parseJson, requireSession } from "@/lib/server/http";
import {
  interestRate,
  loanDateRefinement,
  positiveAmount,
} from "@/lib/server/schemas";

const schema = z
  .object({
    kind: z.enum(LoanKind),
    lenderName: z.string().min(1),
    originalAmount: positiveAmount,
    currency: z.enum(Currency),
    interestRate: interestRate.default(0),
    monthlyPayment: positiveAmount,
    startDate: z.coerce.date(),
    expectedPayoffDate: z.coerce.date().optional().nullable(),
    remainingBalance: positiveAmount,
    entityId: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .superRefine(loanDateRefinement);

export async function GET() {
  try {
    await requireSession();
    return NextResponse.json(await prisma.loan.findMany({ where: { deletedAt: null }, include: { payments: true } }));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const parsed = await parseJson(request, schema);
    return NextResponse.json(
      await prisma.loan.create({
        data: {
          kind: parsed.kind,
          lenderName: parsed.lenderName,
          originalAmountCents: toCents(parsed.originalAmount),
          currency: parsed.currency,
          interestRate: parsed.interestRate,
          monthlyPaymentCents: toCents(parsed.monthlyPayment),
          startDate: parsed.startDate,
          expectedPayoffDate: parsed.expectedPayoffDate ?? undefined,
          remainingBalanceCents: toCents(parsed.remainingBalance),
          entityId: parsed.entityId ?? undefined,
          notes: parsed.notes ?? undefined,
        },
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
