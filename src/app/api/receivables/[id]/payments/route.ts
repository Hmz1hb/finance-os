import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { addReceivablePayment } from "@/lib/server/cashflows";
import { HttpError, jsonError, parseJson, requireSession } from "@/lib/server/http";

const schema = z.object({
  date: z.coerce.date(),
  amount: z
    .union([z.string(), z.number()])
    .refine((value) => Number(typeof value === "string" ? value.replace(/,/g, "") : value) > 0, {
      message: "Payment amount must be greater than 0",
    }),
  notes: z.string().optional().nullable(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const parsed = await parseJson(request, schema);
    const receivable = await prisma.receivable.findFirst({ where: { id, deletedAt: null } });
    if (!receivable) throw new HttpError(404, "Receivable not found");

    const paymentCents = toCents(parsed.amount);
    const outstandingCents = Math.max(0, receivable.amountCents - receivable.paidAmountCents);
    if (paymentCents > outstandingCents) {
      throw new HttpError(400, `Payment exceeds outstanding balance (${outstandingCents} cents remaining)`);
    }

    return NextResponse.json(await addReceivablePayment({ receivableId: id, ...parsed }));
  } catch (error) {
    return jsonError(error);
  }
}
