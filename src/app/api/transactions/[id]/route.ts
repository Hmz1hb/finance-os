import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ContextMode, Currency, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { getMadRate } from "@/lib/server/rates";
import { HttpError, jsonError, parseJson, requireSession } from "@/lib/server/http";

const patchSchema = z.object({
  date: z.coerce.date().optional(),
  kind: z.enum(TransactionType).optional(),
  context: z.enum(ContextMode).optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  currency: z.enum(Currency).optional(),
  categoryId: z.string().optional().nullable(),
  subcategory: z.string().optional().nullable(),
  description: z.string().min(1).optional(),
  counterparty: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  isRecurring: z.coerce.boolean().optional(),
  taxDeductible: z.coerce.boolean().optional(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  entityId: z.string().optional().nullable(),
});

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const transaction = await prisma.transaction.findFirst({
      where: { id, deletedAt: null },
      include: { category: true, attachments: true, entity: true },
    });
    if (!transaction) throw new HttpError(404, "Transaction not found");
    return NextResponse.json(transaction);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const existing = await prisma.transaction.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new HttpError(404, "Transaction not found");
    const parsed = await parseJson(request, patchSchema);

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

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        date: parsed.date ?? undefined,
        kind: parsed.kind ?? undefined,
        context: parsed.context ?? undefined,
        amountCents,
        currency,
        ...(exchangeRateSnapshot !== null ? { exchangeRateSnapshot, madEquivalentCents: madEquivalentCents! } : {}),
        categoryId: parsed.categoryId === undefined ? undefined : parsed.categoryId,
        subcategory: parsed.subcategory === undefined ? undefined : parsed.subcategory,
        description: parsed.description ?? undefined,
        counterparty: parsed.counterparty === undefined ? undefined : parsed.counterparty,
        source: parsed.source === undefined ? undefined : parsed.source,
        paymentMethod: parsed.paymentMethod === undefined ? undefined : parsed.paymentMethod,
        isRecurring: parsed.isRecurring ?? undefined,
        taxDeductible: parsed.taxDeductible ?? undefined,
        notes: parsed.notes === undefined ? undefined : parsed.notes,
        tags: parsed.tags ?? undefined,
        entityId: parsed.entityId === undefined ? undefined : parsed.entityId,
      },
      include: { category: true, attachments: true, entity: true },
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
    const existing = await prisma.transaction.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new HttpError(404, "Transaction not found");
    const now = new Date();
    await prisma.$transaction([
      prisma.transaction.update({ where: { id }, data: { deletedAt: now } }),
      prisma.attachment.updateMany({ where: { transactionId: id, deletedAt: null }, data: { deletedAt: now } }),
    ]);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
