import { prisma } from "@/lib/server/db";
import { getMadRate } from "@/lib/server/rates";

export async function netWorthSnapshot() {
  const [items, loans] = await Promise.all([
    prisma.netWorthItem.findMany({ where: { deletedAt: null }, orderBy: { kind: "asc" } }),
    prisma.loan.findMany({
      where: { deletedAt: null, kind: { not: "OWED_TO_ME" } },
      select: { remainingBalanceCents: true, currency: true },
    }),
  ]);
  const assetsCents = items
    .filter((item) => item.kind === "ASSET")
    .reduce((sum, item) => sum + item.madEquivalentCents, 0);
  const itemLiabilitiesCents = items
    .filter((item) => item.kind === "LIABILITY")
    .reduce((sum, item) => sum + item.madEquivalentCents, 0);

  // FX-convert each loan's remainingBalanceCents from its native currency to MAD
  // before summing — otherwise GBP/USD/EUR cents are summed as if they were MAD.
  // Falls back to 1 if the rate matrix isn't yet seeded.
  let loanLiabilitiesCents = 0;
  for (const loan of loans) {
    const rate = await getMadRate(loan.currency).catch(() => 1);
    loanLiabilitiesCents += Math.round(loan.remainingBalanceCents * rate);
  }

  const liabilitiesCents = itemLiabilitiesCents + loanLiabilitiesCents;
  return {
    assetsCents,
    liabilitiesCents,
    netWorthCents: assetsCents - liabilitiesCents,
    items,
  };
}
