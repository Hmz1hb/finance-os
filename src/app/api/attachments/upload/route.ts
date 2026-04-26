import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { uploadReceiptObject, attachmentTypeFromContentType } from "@/lib/server/aws";
import { HttpError, jsonError, requireSession } from "@/lib/server/http";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BYTES) {
      throw new HttpError(413, "File exceeds 10MB limit");
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Missing file");
    if (file.size > MAX_BYTES) throw new HttpError(413, "File exceeds 10MB limit");

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
