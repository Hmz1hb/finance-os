import { NextRequest, NextResponse } from "next/server";
import { extractReceiptJson } from "@/lib/server/bedrock";
import { jsonError, requireSession } from "@/lib/server/http";

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Missing file");
    if (file.size > 10 * 1024 * 1024) throw new Error("Max file size is 10MB");
    const result = await extractReceiptJson({
      buffer: Buffer.from(await file.arrayBuffer()),
      contentType: file.type || "application/octet-stream",
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
