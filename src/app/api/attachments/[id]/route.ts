import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { deleteReceiptObject } from "@/lib/server/aws";
import { HttpError, jsonError, requireSession } from "@/lib/server/http";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const attachment = await prisma.attachment.findFirst({ where: { id, deletedAt: null } });
    if (!attachment) throw new HttpError(404, "Attachment not found");
    return NextResponse.json(attachment);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const attachment = await prisma.attachment.findFirst({ where: { id, deletedAt: null } });
    if (!attachment) throw new HttpError(404, "Attachment not found");

    await prisma.attachment.update({ where: { id }, data: { deletedAt: new Date() } });

    await deleteReceiptObject(attachment.s3Key).catch((error) => {
      console.error(`Failed to delete S3 object ${attachment.s3Key}:`, error);
    });
    if (attachment.thumbnailS3Key) {
      await deleteReceiptObject(attachment.thumbnailS3Key).catch((error) => {
        console.error(`Failed to delete thumbnail ${attachment.thumbnailS3Key}:`, error);
      });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
