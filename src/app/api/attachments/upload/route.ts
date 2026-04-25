import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { uploadReceiptObject, attachmentTypeFromContentType } from "@/lib/server/aws";
import { jsonError, requireSession } from "@/lib/server/http";

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Missing file");
    if (file.size > 10 * 1024 * 1024) throw new Error("Max file size is 10MB");

    const transactionId = String(form.get("transactionId") ?? "") || null;
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadReceiptObject({
      buffer,
      contentType: file.type || "application/octet-stream",
      filename: file.name,
      transactionId,
    });

    const attachment = await prisma.attachment.create({
      data: {
        transactionId,
        s3Key: uploaded.key,
        thumbnailS3Key: uploaded.thumbnailKey,
        filename: file.name,
        fileType: attachmentTypeFromContentType(uploaded.contentType),
        contentType: uploaded.contentType,
        fileSize: uploaded.size,
      },
    });

    return NextResponse.json(attachment);
  } catch (error) {
    return jsonError(error);
  }
}
