import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Currency, ExpectedIncomeStatus } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { getMadRate } from "@/lib/server/rates";
import { HttpError, jsonError, parseJson, requireSession } from "@/lib/server/http";

const patchSchema = z.object({
  action: z.enum(["unsettle", "cancel", "skip", "update"]).optional(),
  dueDate: z.coerce.date().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  currency: z.enum(Currency).optional(),
  description: z.string().optional(),
  counterparty: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(ExpectedIncomeStatus).optional(),
});

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const expected = await prisma.expectedIncome.findUnique({ where: { id }, include: { entity: true } });
    if (!expected) throw new HttpError(404, "Expected income not found");
    return NextResponse.json(expected);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const existing = await prisma.expectedIncome.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Expected income not found");
    const parsed = await parseJson(request, patchSchema);

    if (parsed.action === "unsettle") {
      if (existing.status !== "SETTLED") {
        throw new HttpError(409, "Expected income is not settled");
      }
      const result = await prisma.$transaction(async (tx) => {
        if (existing.transactionId) {
          await tx.transaction.updateMany({
            where: { id: existing.transactionId, deletedAt: null },
            data: { deletedAt: new Date() },
          });
        }
        return tx.expectedIncome.update({
          where: { id },
          data: { status: "FORECAST", transactionId: null, settledAt: null },
        });
      });
      return NextResponse.json(result);
    }

    if (parsed.action === "cancel") {
      const result = await prisma.expectedIncome.update({ where: { id }, data: { status: "CANCELLED" } });
      return NextResponse.json(result);
    }

    if (parsed.action === "skip") {
      const result = await prisma.expectedIncome.update({ where: { id }, data: { status: "SKIPPED" } });
      return NextResponse.json(result);
    }

    let amountCents = existing.amountCents;
    let currency = existing.currency;
    let exchangeRateSnapshot: number | null = null;
    let madEquivalentCents: number | null = null;
    if (parsed.amount !== undefined) amountCents = toCents(parsed.amount);
    if (parsed.currency !== undefined) currency = parsed.currency;
    if (parsed.amount !== undefined || parsed.currency !== undefined) {
      exchangeRateSnapshot = await getMadRate(currency);
      madEquivalentCents = Math.round(amountCents * exchangeRateSnapshot);
    }

    const updated = await prisma.expectedIncome.update({
      where: { id },
      data: {
        dueDate: parsed.dueDate ?? undefined,
        amountCents,
        currency,
        ...(exchangeRateSnapshot !== null ? { exchangeRateSnapshot, madEquivalentCents: madEquivalentCents! } : {}),
        description: parsed.description ?? undefined,
        counterparty: parsed.counterparty === undefined ? undefined : parsed.counterparty,
        notes: parsed.notes === undefined ? undefined : parsed.notes,
        status: parsed.status ?? undefined,
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
    const existing = await prisma.expectedIncome.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Expected income not found");
    await prisma.expectedIncome.update({ where: { id }, data: { status: "CANCELLED" } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
