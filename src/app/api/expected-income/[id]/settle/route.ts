import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireSession } from "@/lib/server/http";
import { settleExpectedIncome } from "@/lib/server/cashflows";

const schema = z.object({
  date: z.coerce.date().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  notes: z.string().optional().nullable(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const parsed = schema.parse(await request.json().catch(() => ({})));
    return NextResponse.json(await settleExpectedIncome({ id, ...parsed }));
  } catch (error) {
    return jsonError(error);
  }
}
