import { NextResponse } from "next/server";
import { calculateFinancialHealthScore } from "@/lib/server/health";
import { jsonError, requireSession } from "@/lib/server/http";

export async function POST() {
  try {
    await requireSession();
    return NextResponse.json(await calculateFinancialHealthScore());
  } catch (error) {
    return jsonError(error);
  }
}
