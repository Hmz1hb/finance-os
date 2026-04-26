import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Currency, LoanKind } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { HttpError, jsonError, parseJson, requireSession } from "@/lib/server/http";
import {
  interestRateOptional,
  loanDateRefinement,
  positiveAmountOptional,
} from "@/lib/server/schemas";

const patchSchema = z
  .object({
    kind: z.enum(LoanKind).optional(),
    lenderName: z.string().min(1).optional(),
    originalAmount: positiveAmountOptional,
    currency: z.enum(Currency).optional(),
    interestRate: interestRateOptional,
    monthlyPayment: positiveAmountOptional,
    startDate: z.coerce.date().optional(),
    expectedPayoffDate: z.coerce.date().optional().nullable(),
    remainingBalance: positiveAmountOptional,
    entityId: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .superRefine(loanDateRefinement);

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const loan = await prisma.loan.findFirst({ where: { id, deletedAt: null }, include: { payments: true, entity: true } });
    if (!loan) throw new HttpError(404, "Loan not found");
    return NextResponse.json(loan);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const existing = await prisma.loan.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new HttpError(404, "Loan not found");
    const parsed = await parseJson(request, patchSchema);
    const updated = await prisma.loan.update({
      where: { id },
      data: {
        kind: parsed.kind ?? undefined,
        lenderName: parsed.lenderName ?? undefined,
        originalAmountCents: parsed.originalAmount !== undefined ? toCents(parsed.originalAmount) : undefined,
        currency: parsed.currency ?? undefined,
        interestRate: parsed.interestRate ?? undefined,
        monthlyPaymentCents: parsed.monthlyPayment !== undefined ? toCents(parsed.monthlyPayment) : undefined,
        startDate: parsed.startDate ?? undefined,
        expectedPayoffDate: parsed.expectedPayoffDate === undefined ? undefined : parsed.expectedPayoffDate,
        remainingBalanceCents: parsed.remainingBalance !== undefined ? toCents(parsed.remainingBalance) : undefined,
        entityId: parsed.entityId === undefined ? undefined : parsed.entityId,
        notes: parsed.notes === undefined ? undefined : parsed.notes,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const existing = await prisma.loan.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new HttpError(404, "Loan not found");
    await prisma.loan.update({ where: { id }, data: { deletedAt: new Date() } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
