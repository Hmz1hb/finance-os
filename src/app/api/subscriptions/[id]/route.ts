import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ContextMode, Currency, RecurrenceFrequency, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { getMadRate } from "@/lib/server/rates";
import { HttpError, jsonError, parseJson, requireSession } from "@/lib/server/http";
import { positiveAmountOptional } from "@/lib/server/schemas";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  context: z.enum(ContextMode).optional(),
  amount: positiveAmountOptional,
  currency: z.enum(Currency).optional(),
  billingCycle: z.enum(RecurrenceFrequency).optional(),
  nextBillingDate: z.coerce.date().optional(),
  autoRenew: z.coerce.boolean().optional(),
  category: z.string().min(1).optional(),
  cancelUrl: z.string().optional().nullable(),
  status: z.enum(SubscriptionStatus).optional(),
  entityId: z.string().optional().nullable(),
});

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const sub = await prisma.subscription.findFirst({ where: { id, deletedAt: null } });
    if (!sub) throw new HttpError(404, "Subscription not found");
    return NextResponse.json(sub);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const existing = await prisma.subscription.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new HttpError(404, "Subscription not found");
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

    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        name: parsed.name ?? undefined,
        context: parsed.context ?? undefined,
        amountCents,
        currency,
        ...(exchangeRateSnapshot !== null ? { exchangeRateSnapshot, madEquivalentCents: madEquivalentCents! } : {}),
        billingCycle: parsed.billingCycle ?? undefined,
        nextBillingDate: parsed.nextBillingDate ?? undefined,
        autoRenew: parsed.autoRenew ?? undefined,
        category: parsed.category ?? undefined,
        cancelUrl: parsed.cancelUrl === undefined ? undefined : parsed.cancelUrl,
        status: parsed.status ?? undefined,
        cancelledAt: parsed.status === "CANCELLED" ? new Date() : undefined,
        entityId: parsed.entityId === undefined ? undefined : parsed.entityId,
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
    const existing = await prisma.subscription.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new HttpError(404, "Subscription not found");
    await prisma.subscription.update({ where: { id }, data: { deletedAt: new Date() } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
