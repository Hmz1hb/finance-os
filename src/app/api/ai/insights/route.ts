import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { financialContextSnapshot } from "@/lib/server/analytics";
import { jsonError, requireSession } from "@/lib/server/http";

export async function GET() {
  try {
    await requireSession();
    const insights = await prisma.aIInsight.findMany({ orderBy: { generatedAt: "desc" }, take: 30 });
    return NextResponse.json(insights);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST() {
  try {
    await requireSession();
    const snapshot = await financialContextSnapshot();
    const content = `Income ${snapshot.incomeMadCents / 100} MAD, expenses ${snapshot.expenseMadCents / 100} MAD, savings rate ${snapshot.savingsRate}%. Review top categories and upcoming obligations.`;
    const insight = await prisma.aIInsight.create({
      data: { type: "MONTHLY_SUMMARY", content, payload: snapshot },
    });
    return NextResponse.json(insight);
  } catch (error) {
    return jsonError(error);
  }
}
