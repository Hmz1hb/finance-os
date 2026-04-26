import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { getMadRate } from "@/lib/server/rates";
import { HttpError, jsonError, parseJson, requireSession } from "@/lib/server/http";

const schema = z.object({
  date: z.coerce.date().default(() => new Date()),
  amount: z.union([z.string(), z.number()]),
  notes: z.string().optional().nullable(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const goal = await prisma.goal.findFirst({ where: { id, deletedAt: null } });
    if (!goal) throw new HttpError(404, "Goal not found");
    const parsed = await parseJson(request, schema);
    const amountCents = toCents(parsed.amount);
    if (amountCents === 0) throw new HttpError(400, "Contribution amount must be non-zero");

    const remainingCents = Math.max(0, goal.targetAmountCents - goal.currentSavedCents);
    if (amountCents > remainingCents) {
      throw new HttpError(400, `Contribution exceeds remaining target (${remainingCents} cents remaining)`);
    }

    const rate = await getMadRate(goal.currency);
    const madEquivalentCents = Math.round(amountCents * rate);

    return NextResponse.json(
      await prisma.$transaction(async (tx) => {
        const contribution = await tx.goalContribution.create({
          data: {
            goalId: goal.id,
            date: parsed.date,
            amountCents,
            currency: goal.currency,
            exchangeRateSnapshot: rate,
            madEquivalentCents,
            notes: parsed.notes ?? undefined,
          },
        });
        const updated = await tx.goal.update({
          where: { id: goal.id },
          data: { currentSavedCents: { increment: amountCents } },
        });
        return { contribution, goal: updated };
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
