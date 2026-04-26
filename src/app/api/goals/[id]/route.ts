import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Currency, GoalCategory } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { HttpError, jsonError, parseJson, requireSession } from "@/lib/server/http";
import {
  nonNegativeAmountOptional,
  positiveAmountOptional,
} from "@/lib/server/schemas";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  targetAmount: positiveAmountOptional,
  currency: z.enum(Currency).optional(),
  currentSaved: nonNegativeAmountOptional,
  targetDate: z.coerce.date().optional().nullable(),
  priority: z.coerce.number().int().min(1).max(5).optional(),
  category: z.enum(GoalCategory).optional(),
  notes: z.string().optional().nullable(),
  entityId: z.string().optional().nullable(),
});

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const goal = await prisma.goal.findFirst({ where: { id, deletedAt: null }, include: { contributions: true, entity: true } });
    if (!goal) throw new HttpError(404, "Goal not found");
    return NextResponse.json(goal);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const existing = await prisma.goal.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new HttpError(404, "Goal not found");
    const parsed = await parseJson(request, patchSchema);
    const updated = await prisma.goal.update({
      where: { id },
      data: {
        name: parsed.name ?? undefined,
        targetAmountCents: parsed.targetAmount !== undefined ? toCents(parsed.targetAmount) : undefined,
        currency: parsed.currency ?? undefined,
        currentSavedCents: parsed.currentSaved !== undefined ? toCents(parsed.currentSaved) : undefined,
        targetDate: parsed.targetDate === undefined ? undefined : parsed.targetDate,
        priority: parsed.priority ?? undefined,
        category: parsed.category ?? undefined,
        notes: parsed.notes === undefined ? undefined : parsed.notes,
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
    const existing = await prisma.goal.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new HttpError(404, "Goal not found");
    await prisma.goal.update({ where: { id }, data: { deletedAt: new Date() } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
