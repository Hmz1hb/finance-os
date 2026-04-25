import { randomUUID } from "crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import { AttachmentType } from "@prisma/client";

const region = process.env.AWS_REGION ?? "eu-west-2";

export const s3 = new S3Client({ region });

export function requireBucket() {
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) throw new Error("S3_BUCKET_NAME is not configured");
  return bucket;
}

export function attachmentTypeFromContentType(contentType: string): AttachmentType {
  if (contentType.startsWith("image/")) return AttachmentType.IMAGE;
  if (contentType === "application/pdf") return AttachmentType.PDF;
  return AttachmentType.OTHER;
}

export function receiptKey(input: { transactionId?: string | null; filename: string; date?: Date }) {
  const date = input.date ?? new Date();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const transactionId = input.transactionId ?? "unlinked";
  const safeName = input.filename.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `receipts/${year}/${month}/${transactionId}/${randomUUID()}-${safeName}`;
}

export async function prepareUpload(buffer: Buffer, contentType: string) {
  if (!contentType.startsWith("image/")) {
    return { body: buffer, thumbnail: null as Buffer | null, contentType };
  }

  const image = sharp(buffer, { failOn: "none" }).rotate();
  const body = await image
    .clone()
    .resize({ width: 1500, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  const thumbnail = await image
    .clone()
    .resize({ width: 200, height: 200, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();

  return { body, thumbnail, contentType: "image/jpeg" };
}

export async function uploadReceiptObject(input: {
  buffer: Buffer;
  contentType: string;
  filename: string;
  transactionId?: string | null;
}) {
  const bucket = requireBucket();
  const prepared = await prepareUpload(input.buffer, input.contentType);
  const key = receiptKey({ filename: input.filename, transactionId: input.transactionId });
  const thumbnailKey = prepared.thumbnail ? key.replace(/(\.[^.]+)?$/, "-thumb.jpg") : null;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: prepared.body,
      ContentType: prepared.contentType,
      ServerSideEncryption: "AES256",
    }),
  );

  if (thumbnailKey && prepared.thumbnail) {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: thumbnailKey,
        Body: prepared.thumbnail,
        ContentType: "image/jpeg",
        ServerSideEncryption: "AES256",
      }),
    );
  }

  return { key, thumbnailKey, contentType: prepared.contentType, size: prepared.body.byteLength };
}

export async function presignedGetUrl(key: string, expiresIn = 3600) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: requireBucket(),
      Key: key,
    }),
    { expiresIn },
  );
}
