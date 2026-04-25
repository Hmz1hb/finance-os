import { randomUUID } from "crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import { AttachmentType } from "@prisma/client";
import { HttpError } from "@/lib/server/errors";

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

type DetectedFileType = { contentType: string; extension: string };

function detectFileType(buffer: Buffer): DetectedFileType | null {
  if (buffer.length < 12) return null;
  const b = buffer;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    return { contentType: "image/png", extension: "png" };
  }
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) {
    return { contentType: "application/pdf", extension: "pdf" };
  }
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }
  // HEIC: bytes 4-11 are "ftyp" + brand. Brands: heic, heix, mif1, msf1, hevc.
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = b.slice(8, 12).toString("ascii");
    if (["heic", "heix", "mif1", "msf1", "hevc"].includes(brand)) {
      return { contentType: "image/heic", extension: "heic" };
    }
  }
  return null;
}

export async function prepareUpload(buffer: Buffer, contentType: string) {
  void contentType;
  const detected = detectFileType(buffer);
  if (!detected) {
    throw new HttpError(400, "Unsupported file type. Allowed: JPEG, PNG, PDF, WEBP, HEIC.");
  }

  const verifiedContentType = detected.contentType;

  if (!verifiedContentType.startsWith("image/")) {
    return { body: buffer, thumbnail: null as Buffer | null, contentType: verifiedContentType };
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
      ContentDisposition: "attachment",
      CacheControl: "private, max-age=3600",
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
        ContentDisposition: "attachment",
        CacheControl: "private, max-age=3600",
        ServerSideEncryption: "AES256",
      }),
    );
  }

  return { key, thumbnailKey, contentType: prepared.contentType, size: prepared.body.byteLength };
}

export async function deleteReceiptObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: requireBucket(), Key: key }));
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
