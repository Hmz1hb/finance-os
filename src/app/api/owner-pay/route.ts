import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Currency, OwnerCompensationType } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { jsonError, requireSession } from "@/lib/server/http";
import { createOwnerCompensation } from "@/lib/server/owner-pay";

const schema = z.object({
  date: z.coerce.date(),
  amount: z.union([z.string(), z.number()]),
  currency: z.enum(Currency),
  paymentType: z.enum(OwnerCompensationType),
  taxTreatment: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  fromEntityId: z.string().optional(),
  toEntityId: z.string().optional(),
});

export async function GET() {
  try {
    await requireSession();
    return NextResponse.json(
      await prisma.ownerCompensation.findMany({
        include: { fromEntity: true, toEntity: true },
        orderBy: { date: "desc" },
        take: 100,
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
    return NextResponse.json(await createOwnerCompensation(parsed));
  } catch (error) {
    return jsonError(error);
  }
}
