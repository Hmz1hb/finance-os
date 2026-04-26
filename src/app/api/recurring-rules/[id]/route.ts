import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Currency, RecurringCadence, RecurringRuleType } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { HttpError, jsonError, parseJson, requireSession } from "@/lib/server/http";
import { positiveAmountOptional, recurringRuleRefinement } from "@/lib/server/schemas";

const patchSchema = z
  .object({
    title: z.string().min(1).optional(),
    ruleType: z.enum(RecurringRuleType).optional(),
    cadence: z.enum(RecurringCadence).optional(),
    intervalDays: z.coerce.number().int().positive().optional().nullable(),
    dayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
    secondDayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional().nullable(),
    nextDueDate: z.coerce.date().optional(),
    amount: positiveAmountOptional,
    currency: z.enum(Currency).optional(),
    counterparty: z.string().optional().nullable(),
    autoCreate: z.coerce.boolean().optional(),
    notes: z.string().optional().nullable(),
  })
  .superRefine(recurringRuleRefinement);

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const rule = await prisma.recurringRule.findFirst({
      where: { id, deletedAt: null },
      include: { entity: true, expectedIncomes: { orderBy: { dueDate: "asc" }, take: 5 } },
    });
    if (!rule) throw new HttpError(404, "Recurring rule not found");
    return NextResponse.json(rule);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const existing = await prisma.recurringRule.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new HttpError(404, "Recurring rule not found");
    const parsed = await parseJson(request, patchSchema);
    const updated = await prisma.recurringRule.update({
      where: { id },
      data: {
        title: parsed.title ?? undefined,
        ruleType: parsed.ruleType ?? undefined,
        cadence: parsed.cadence ?? undefined,
        intervalDays: parsed.intervalDays === undefined ? undefined : parsed.intervalDays,
        dayOfMonth: parsed.dayOfMonth === undefined ? undefined : parsed.dayOfMonth,
        secondDayOfMonth: parsed.secondDayOfMonth === undefined ? undefined : parsed.secondDayOfMonth,
        startDate: parsed.startDate ?? undefined,
        endDate: parsed.endDate === undefined ? undefined : parsed.endDate,
        nextDueDate: parsed.nextDueDate ?? undefined,
        amountCents: parsed.amount !== undefined ? toCents(parsed.amount) : undefined,
        currency: parsed.currency ?? undefined,
        counterparty: parsed.counterparty === undefined ? undefined : parsed.counterparty,
        autoCreate: parsed.autoCreate ?? undefined,
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
    const existing = await prisma.recurringRule.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new HttpError(404, "Recurring rule not found");
    await prisma.$transaction([
      prisma.recurringRule.update({ where: { id }, data: { deletedAt: new Date() } }),
      prisma.expectedIncome.updateMany({
        where: { recurringRuleId: id, status: { in: ["FORECAST", "DUE"] } },
        data: { status: "CANCELLED" },
      }),
    ]);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
