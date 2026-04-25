import { prisma } from "@/lib/server/db";

export async function netWorthSnapshot() {
  const [items, loans] = await Promise.all([
    prisma.netWorthItem.findMany({ where: { deletedAt: null }, orderBy: { kind: "asc" } }),
    prisma.loan.aggregate({
      where: { deletedAt: null, kind: { not: "OWED_TO_ME" } },
      _sum: { remainingBalanceCents: true },
    }),
  ]);
  const assetsCents = items
    .filter((item) => item.kind === "ASSET")
    .reduce((sum, item) => sum + item.madEquivalentCents, 0);
  const itemLiabilitiesCents = items
    .filter((item) => item.kind === "LIABILITY")
    .reduce((sum, item) => sum + item.madEquivalentCents, 0);
  const loanLiabilitiesCents = loans._sum.remainingBalanceCents ?? 0;
  const liabilitiesCents = itemLiabilitiesCents + loanLiabilitiesCents;
  return {
    assetsCents,
    liabilitiesCents,
    netWorthCents: assetsCents - liabilitiesCents,
    items,
  };
}
