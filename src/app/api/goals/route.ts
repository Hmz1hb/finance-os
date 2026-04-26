import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Currency, GoalCategory } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { jsonError, parseJson, requireSession } from "@/lib/server/http";
import { nonNegativeAmountOptional, positiveAmount } from "@/lib/server/schemas";

const schema = z.object({
  name: z.string().min(1),
  targetAmount: positiveAmount,
  currency: z.enum(Currency),
  currentSaved: nonNegativeAmountOptional,
  targetDate: z.coerce.date().optional().nullable(),
  priority: z.coerce.number().int().min(1).max(5).default(3),
  category: z.enum(GoalCategory),
  notes: z.string().optional().nullable(),
  entityId: z.string().optional().nullable(),
});

export async function GET() {
  try {
    await requireSession();
    return NextResponse.json(await prisma.goal.findMany({ where: { deletedAt: null }, orderBy: [{ priority: "asc" }, { name: "asc" }] }));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const parsed = await parseJson(request, schema);
    return NextResponse.json(
      await prisma.goal.create({
        data: {
          name: parsed.name,
          targetAmountCents: toCents(parsed.targetAmount),
          currency: parsed.currency,
          currentSavedCents: parsed.currentSaved ? toCents(parsed.currentSaved) : 0,
          targetDate: parsed.targetDate ?? undefined,
          priority: parsed.priority,
          category: parsed.category,
          notes: parsed.notes ?? undefined,
          entityId: parsed.entityId ?? undefined,
        },
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
