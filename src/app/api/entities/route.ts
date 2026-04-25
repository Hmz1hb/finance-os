import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Currency, FinancialEntityType } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { jsonError, requireSession } from "@/lib/server/http";
import { listEntities } from "@/lib/server/entities";

const schema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  type: z.enum(FinancialEntityType),
  baseCurrency: z.enum(Currency),
  country: z.string().min(2),
  taxResidence: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().default(10),
});

export async function GET() {
  try {
    await requireSession();
    return NextResponse.json(await listEntities());
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const parsed = schema.parse(await request.json());
    return NextResponse.json(await prisma.financialEntity.create({ data: parsed }));
  } catch (error) {
    return jsonError(error);
  }
}
