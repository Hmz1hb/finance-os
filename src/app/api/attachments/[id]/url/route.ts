import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { presignedGetUrl } from "@/lib/server/aws";
import { jsonError, requireSession } from "@/lib/server/http";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const attachment = await prisma.attachment.findUniqueOrThrow({ where: { id } });
    return NextResponse.json({
      url: await presignedGetUrl(attachment.s3Key),
      thumbnailUrl: attachment.thumbnailS3Key ? await presignedGetUrl(attachment.thumbnailS3Key) : null,
    });
  } catch (error) {
    return jsonError(error);
  }
}
