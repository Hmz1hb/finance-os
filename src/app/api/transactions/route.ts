import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ContextMode, Currency, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { jsonError, requireSession } from "@/lib/server/http";
import { getMadRate } from "@/lib/server/rates";
import { MOROCCO_PERSONAL_ENTITY_ID, UK_LTD_ENTITY_ID } from "@/lib/server/entities";

const transactionSchema = z.object({
  date: z.coerce.date(),
  kind: z.enum(TransactionType),
  context: z.enum(ContextMode),
  amount: z.union([z.string(), z.number()]),
  currency: z.enum(Currency),
  categoryId: z.string().optional().nullable(),
  subcategory: z.string().optional().nullable(),
  description: z.string().min(1),
  counterparty: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  isRecurring: z.coerce.boolean().default(false),
  taxDeductible: z.coerce.boolean().default(false),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  entityId: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const params = request.nextUrl.searchParams;
    const year = Number(params.get("year") ?? new Date().getFullYear());
    const context = params.get("context");
    const entityId = params.get("entityId");
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    const transactions = await prisma.transaction.findMany({
      where: {
        deletedAt: null,
        date: { gte: start, lt: end },
        ...(entityId && entityId !== "combined" ? { entityId } : {}),
        ...(context && context !== "COMBINED" ? { context: context as ContextMode } : {}),
      },
      include: { category: true, attachments: true },
      orderBy: { date: "desc" },
      take: 300,
    });
    return NextResponse.json(transactions);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const parsed = transactionSchema.parse(await request.json());
    const amountCents = toCents(parsed.amount);
    const exchangeRateSnapshot = await getMadRate(parsed.currency);
    const entityId = parsed.entityId ?? (parsed.context === ContextMode.BUSINESS ? UK_LTD_ENTITY_ID : MOROCCO_PERSONAL_ENTITY_ID);
    const transaction = await prisma.transaction.create({
      data: {
        date: parsed.date,
        kind: parsed.kind,
        context: parsed.context,
        entityId,
        amountCents,
        currency: parsed.currency,
        exchangeRateSnapshot,
        madEquivalentCents: Math.round(amountCents * exchangeRateSnapshot),
        categoryId: parsed.categoryId ?? undefined,
        subcategory: parsed.subcategory ?? undefined,
        description: parsed.description,
        counterparty: parsed.counterparty ?? undefined,
        source: parsed.source ?? undefined,
        paymentMethod: parsed.paymentMethod ?? undefined,
        isRecurring: parsed.isRecurring,
        taxDeductible: parsed.taxDeductible,
        notes: parsed.notes ?? undefined,
        tags: parsed.tags,
      },
      include: { category: true },
    });
    return NextResponse.json(transaction);
  } catch (error) {
    return jsonError(error);
  }
}
