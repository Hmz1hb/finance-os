import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { jsonError, requireSession } from "@/lib/server/http";
import { createTaxReserve, estimateMoroccoAeTax, estimateUkLtdTax } from "@/lib/server/tax";

const schema = z.object({
  entityId: z.string().optional(),
  createReserve: z.coerce.boolean().default(false),
});

export async function GET() {
  try {
    await requireSession();
    const [ukLtd, morocco, reserves] = await Promise.all([
      estimateUkLtdTax(),
      estimateMoroccoAeTax(),
      prisma.taxReserve.findMany({ include: { entity: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    ]);
    return NextResponse.json({ estimates: [ukLtd, morocco], reserves });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const parsed = schema.parse(await request.json().catch(() => ({})));
    if (parsed.createReserve) {
      return NextResponse.json(await createTaxReserve(parsed.entityId));
    }
    return NextResponse.json(parsed.entityId === "uk_ltd" ? await estimateUkLtdTax() : await estimateMoroccoAeTax());
  } catch (error) {
    return jsonError(error);
  }
}
