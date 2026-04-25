import { NextResponse } from "next/server";
import { generateRecurringInstances } from "@/lib/server/recurring";
import { jsonError, requireSession } from "@/lib/server/http";

export async function POST() {
  try {
    await requireSession();
    return NextResponse.json({ created: await generateRecurringInstances() });
  } catch (error) {
    return jsonError(error);
  }
}
