import { NextResponse } from "next/server";
import { Currency } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { jsonError, requireSession } from "@/lib/server/http";

export async function POST() {
  try {
    await requireSession();
    const items = await prisma.netWorthItem.findMany({ where: { deletedAt: null, includeInSnapshots: true } });
    const totalAssetsCents = items.filter((item) => item.kind === "ASSET").reduce((sum, item) => sum + item.madEquivalentCents, 0);
    const totalLiabilitiesCents = items.filter((item) => item.kind === "LIABILITY").reduce((sum, item) => sum + item.madEquivalentCents, 0);
    const snapshot = await prisma.netWorthSnapshot.create({
      data: {
        totalAssetsCents,
        totalLiabilitiesCents,
        netWorthCents: totalAssetsCents - totalLiabilitiesCents,
        currency: Currency.MAD,
      },
    });
    return NextResponse.json(snapshot);
  } catch (error) {
    return jsonError(error);
  }
}
