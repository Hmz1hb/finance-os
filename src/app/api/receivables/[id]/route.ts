import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Currency, ReceivableKind, ReceivableStatus } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { getMadRate } from "@/lib/server/rates";
import { HttpError, jsonError, parseJson, requireSession } from "@/lib/server/http";

const patchSchema = z.object({
  kind: z.enum(ReceivableKind).optional(),
  counterparty: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  issueDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional().nullable(),
  amount: z.union([z.string(), z.number()]).optional(),
  currency: z.enum(Currency).optional(),
  source: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(ReceivableStatus).optional(),
});

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const receivable = await prisma.receivable.findFirst({
      where: { id, deletedAt: null },
      include: { entity: true, payments: true },
    });
    if (!receivable) throw new HttpError(404, "Receivable not found");
    return NextResponse.json(receivable);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const existing = await prisma.receivable.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new HttpError(404, "Receivable not found");
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

    const updated = await prisma.receivable.update({
      where: { id },
      data: {
        kind: parsed.kind ?? undefined,
        counterparty: parsed.counterparty ?? undefined,
        title: parsed.title ?? undefined,
        issueDate: parsed.issueDate ?? undefined,
        dueDate: parsed.dueDate === undefined ? undefined : parsed.dueDate,
        amountCents,
        currency,
        ...(exchangeRateSnapshot !== null ? { exchangeRateSnapshot, madEquivalentCents: madEquivalentCents! } : {}),
        source: parsed.source === undefined ? undefined : parsed.source,
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
    const existing = await prisma.receivable.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new HttpError(404, "Receivable not found");
    const now = new Date();
    await prisma.$transaction([
      prisma.receivable.update({ where: { id }, data: { deletedAt: now, status: "CANCELLED" } }),
      prisma.expectedIncome.updateMany({
        where: { receivableId: id, status: { in: ["FORECAST", "DUE"] } },
        data: { status: "CANCELLED" },
      }),
    ]);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
