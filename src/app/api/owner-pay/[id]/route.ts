import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Currency, OwnerCompensationType } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { getMadRate } from "@/lib/server/rates";
import { HttpError, jsonError, parseJson, requireSession } from "@/lib/server/http";
import { positiveAmountOptional } from "@/lib/server/schemas";

const patchSchema = z.object({
  date: z.coerce.date().optional(),
  amount: positiveAmountOptional,
  currency: z.enum(Currency).optional(),
  paymentType: z.enum(OwnerCompensationType).optional(),
  taxTreatment: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const record = await prisma.ownerCompensation.findUnique({
      where: { id },
      include: { fromEntity: true, toEntity: true },
    });
    if (!record) throw new HttpError(404, "Owner pay record not found");
    return NextResponse.json(record);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const existing = await prisma.ownerCompensation.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Owner pay record not found");
    const parsed = await parseJson(request, patchSchema);

    let amountCents = existing.amountCents;
    let currency = existing.currency;
    let exchangeRateSnapshot = Number(existing.exchangeRateSnapshot);
    let madEquivalentCents = existing.madEquivalentCents;
    if (parsed.amount !== undefined) amountCents = toCents(parsed.amount);
    if (parsed.currency !== undefined) currency = parsed.currency;
    if (parsed.amount !== undefined || parsed.currency !== undefined) {
      exchangeRateSnapshot = await getMadRate(currency);
      madEquivalentCents = Math.round(amountCents * exchangeRateSnapshot);
    }

    return NextResponse.json(
      await prisma.$transaction(async (tx) => {
        const updated = await tx.ownerCompensation.update({
          where: { id },
          data: {
            date: parsed.date ?? undefined,
            amountCents,
            currency,
            exchangeRateSnapshot,
            madEquivalentCents,
            paymentType: parsed.paymentType ?? undefined,
            taxTreatment: parsed.taxTreatment === undefined ? undefined : parsed.taxTreatment,
            notes: parsed.notes === undefined ? undefined : parsed.notes,
          },
        });

        const txData = {
          date: parsed.date ?? undefined,
          amountCents,
          currency,
          exchangeRateSnapshot,
          madEquivalentCents,
          notes: parsed.notes === undefined ? undefined : parsed.notes,
        };
        if (existing.businessTransactionId) {
          await tx.transaction.updateMany({
            where: { id: existing.businessTransactionId, deletedAt: null },
            data: txData,
          });
        }
        if (existing.personalTransactionId) {
          await tx.transaction.updateMany({
            where: { id: existing.personalTransactionId, deletedAt: null },
            data: txData,
          });
        }

        return updated;
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const existing = await prisma.ownerCompensation.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Owner pay record not found");
    await prisma.$transaction(async (tx) => {
      const now = new Date();
      if (existing.businessTransactionId) {
        await tx.transaction.updateMany({
          where: { id: existing.businessTransactionId, deletedAt: null },
          data: { deletedAt: now },
        });
      }
      if (existing.personalTransactionId) {
        await tx.transaction.updateMany({
          where: { id: existing.personalTransactionId, deletedAt: null },
          data: { deletedAt: now },
        });
      }
      await tx.ownerCompensation.delete({ where: { id } });
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
