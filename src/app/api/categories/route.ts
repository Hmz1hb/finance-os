import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ContextMode, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { jsonError, parseJson, requireSession } from "@/lib/server/http";
import { slugify } from "@/lib/utils";

const categorySchema = z.object({
  name: z.string().min(2),
  type: z.enum(TransactionType),
  context: z.enum(ContextMode),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export async function GET() {
  try {
    await requireSession();
    const categories = await prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: [{ context: "asc" }, { type: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(categories);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const parsed = await parseJson(request, categorySchema);
    const category = await prisma.category.create({
      data: {
        ...parsed,
        slug: slugify(`${parsed.context}-${parsed.type}-${parsed.name}`),
        isSystem: false,
      },
    });
    return NextResponse.json(category);
  } catch (error) {
    return jsonError(error);
  }
}
