import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Currency, RecurringCadence, RecurringRuleType } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { jsonError, requireSession } from "@/lib/server/http";
import { createRecurringRule } from "@/lib/server/cashflows";

const schema = z.object({
  entityId: z.string().min(1),
  title: z.string().min(1),
  ruleType: z.enum(RecurringRuleType).default("EXPECTED_INCOME"),
  cadence: z.enum(RecurringCadence),
  intervalDays: z.coerce.number().int().positive().optional().nullable(),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
  secondDayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  amount: z.union([z.string(), z.number()]),
  currency: z.enum(Currency),
  counterparty: z.string().optional().nullable(),
  autoCreate: z.coerce.boolean().default(false),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const entityId = request.nextUrl.searchParams.get("entityId") ?? undefined;
    return NextResponse.json(
      await prisma.recurringRule.findMany({
        where: { deletedAt: null, ...(entityId ? { entityId } : {}) },
        include: { entity: true, expectedIncomes: { orderBy: { dueDate: "asc" }, take: 3 } },
        orderBy: { nextDueDate: "asc" },
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const parsed = schema.parse(await request.json());
    return NextResponse.json(await createRecurringRule(parsed));
  } catch (error) {
    return jsonError(error);
  }
}
