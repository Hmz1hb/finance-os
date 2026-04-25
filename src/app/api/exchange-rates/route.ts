import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Currency } from "@prisma/client";
import { jsonError, requireSession } from "@/lib/server/http";
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

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const body = await request.json().catch(() => ({}));
    if (body.action === "refresh") {
      await refreshExchangeRates();
      return NextResponse.json(await rateSummary());
    }
    const parsed = manualRateSchema.parse(body);
    await setManualRate(parsed);
    return NextResponse.json(await rateSummary());
  } catch (error) {
    return jsonError(error);
  }
}
