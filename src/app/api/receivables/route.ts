import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Currency, ReceivableKind } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { jsonError, parseJson, requireSession } from "@/lib/server/http";
import { createReceivable, receivableStatus } from "@/lib/server/cashflows";

const schema = z.object({
  entityId: z.string().min(1),
  kind: z.enum(ReceivableKind),
  counterparty: z.string().min(1),
  title: z.string().min(1),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().optional().nullable(),
  amount: z
    .union([z.string(), z.number()])
    .refine((value) => Number(typeof value === "string" ? value.replace(/,/g, "") : value) > 0, {
      message: "Amount must be greater than 0",
    }),
  currency: z.enum(Currency),
  source: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const entityId = request.nextUrl.searchParams.get("entityId") ?? undefined;
    const receivables = await prisma.receivable.findMany({
      where: { deletedAt: null, ...(entityId ? { entityId } : {}) },
      include: { entity: true, payments: true },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(
      receivables.map((receivable) => ({
        ...receivable,
        computedStatus: receivableStatus(receivable),
      })),
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const parsed = await parseJson(request, schema);
    return NextResponse.json(await createReceivable(parsed));
  } catch (error) {
    return jsonError(error);
  }
}
