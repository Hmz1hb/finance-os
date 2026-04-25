import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Currency } from "@prisma/client";
import { HttpError, jsonError, requireSession } from "@/lib/server/http";
import { rateSummary, refreshExchangeRates, setManualRate } from "@/lib/server/rates";

const manualRateSchema = z.object({
  baseCurrency: z.enum(Currency),
  targetCurrency: z.enum(Currency),
  rate: z.coerce.number().positive(),
});

export async function GET() {
  try {
    await requireSession();
    return NextResponse.json(await rateSummary());
  } catch (error) {
    return jsonError(error);
  }
}

async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await request.json().catch(() => ({}))) as Record<string, unknown>;
  }
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData().catch(() => null);
    if (!form) return {};
    return Object.fromEntries(form.entries());
  }
  return (await request.json().catch(() => ({}))) as Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const body = await readBody(request);
    if (body.action === "refresh") {
      await refreshExchangeRates();
      return NextResponse.json(await rateSummary());
    }
    const result = manualRateSchema.safeParse(body);
    if (!result.success) {
      throw new HttpError(
        400,
        "Invalid rate payload",
        result.error.issues.map((issue) => ({ path: issue.path.map(String).join(".") || "(root)", message: issue.message })),
      );
    }
    await setManualRate(result.data);
    return NextResponse.json(await rateSummary());
  } catch (error) {
    return jsonError(error);
  }
}
