import { NextRequest, NextResponse } from "next/server";
import { extractReceiptJson } from "@/lib/server/bedrock";
import { HttpError, jsonError, requireSession } from "@/lib/server/http";

const MAX_BYTES = 10 * 1024 * 1024;

function isBedrockUnavailable(message: string) {
  return (
    message.includes("Model use case details have not been submitted") ||
    message.includes("AccessDeniedException") ||
    message.includes("ValidationException: Could not access model")
  );
}

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      throw new HttpError(415, "Expected multipart/form-data");
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new HttpError(415, "Expected multipart/form-data");
    }
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Missing file");
    if (file.size > MAX_BYTES) throw new HttpError(413, "File exceeds 10MB limit");
    try {
      const result = await extractReceiptJson({
        buffer: Buffer.from(await file.arrayBuffer()),
        contentType: file.type || "application/octet-stream",
      });
      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isBedrockUnavailable(message)) {
        return NextResponse.json(
          { error: "Receipt OCR is unavailable", code: "AI_UNAVAILABLE" },
          { status: 503 },
        );
      }
      throw error;
    }
  } catch (error) {
    return jsonError(error);
  }
}
