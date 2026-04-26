import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ContextMode, Currency, RecurrenceFrequency } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { getMadRate } from "@/lib/server/rates";
import { jsonError, parseJson, requireSession } from "@/lib/server/http";
import { positiveAmount } from "@/lib/server/schemas";

const schema = z.object({
  name: z.string().min(1),
  context: z.enum(ContextMode),
  amount: positiveAmount,
  currency: z.enum(Currency),
  billingCycle: z.enum(RecurrenceFrequency),
  nextBillingDate: z.coerce.date(),
  autoRenew: z.coerce.boolean().default(true),
  category: z.string().min(1),
  cancelUrl: z.string().optional().nullable(),
  entityId: z.string().optional().nullable(),
});

export async function GET() {
  try {
    await requireSession();
    return NextResponse.json(
      await prisma.subscription.findMany({ where: { deletedAt: null }, orderBy: { nextBillingDate: "asc" } }),
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const parsed = await parseJson(request, schema);
    const amountCents = toCents(parsed.amount);
    const rate = await getMadRate(parsed.currency);
    return NextResponse.json(
      await prisma.subscription.create({
        data: {
          name: parsed.name,
          context: parsed.context,
          currency: parsed.currency,
          billingCycle: parsed.billingCycle,
          nextBillingDate: parsed.nextBillingDate,
          autoRenew: parsed.autoRenew,
          category: parsed.category,
          amountCents,
          exchangeRateSnapshot: rate,
          madEquivalentCents: Math.round(amountCents * rate),
          cancelUrl: parsed.cancelUrl ?? undefined,
          entityId: parsed.entityId ?? undefined,
        },
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
