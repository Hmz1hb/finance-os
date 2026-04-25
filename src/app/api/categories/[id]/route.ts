import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ContextMode, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { HttpError, jsonError, parseJson, requireSession } from "@/lib/server/http";

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  type: z.enum(TransactionType).optional(),
  context: z.enum(ContextMode).optional(),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
});

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const category = await prisma.category.findFirst({ where: { id, deletedAt: null } });
    if (!category) throw new HttpError(404, "Category not found");
    return NextResponse.json(category);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const existing = await prisma.category.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new HttpError(404, "Category not found");
    if (existing.isSystem) throw new HttpError(403, "System categories cannot be modified");
    const parsed = await parseJson(request, patchSchema);
    const updated = await prisma.category.update({
      where: { id },
      data: {
        name: parsed.name ?? undefined,
        type: parsed.type ?? undefined,
        context: parsed.context ?? undefined,
        color: parsed.color === undefined ? undefined : parsed.color,
        icon: parsed.icon === undefined ? undefined : parsed.icon,
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
    const existing = await prisma.category.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new HttpError(404, "Category not found");
    if (existing.isSystem) throw new HttpError(403, "System categories cannot be deleted");
    await prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
