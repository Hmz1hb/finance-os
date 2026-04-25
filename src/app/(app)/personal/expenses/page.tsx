import { PageHeader } from "@/components/app/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { formatMad } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

export default async function PersonalExpensesPage() {
  const rows = await prisma.transaction.findMany({ where: { entityId: "morocco_personal", kind: "EXPENSE", deletedAt: null }, include: { category: true }, orderBy: { date: "desc" }, take: 150 }).catch(() => []);
  return (
    <>
      <PageHeader title="Personal expenses" description="Fixed essentials, living costs, vehicle logs, health, lifestyle, home, education, giving, and uncategorized spending." badge="Spending" />
      <Card><CardHeader><CardTitle>Spending ledger</CardTitle></CardHeader><div className="space-y-2">{rows.map((row) => <div key={row.id} className="flex justify-between rounded-md bg-surface-inset p-3"><div><p className="text-sm">{row.description}</p><p className="text-xs text-muted-ledger">{row.category?.name ?? "Uncategorized"}</p></div><span className="text-sm font-semibold text-red-risk">{formatMad(row.madEquivalentCents)}</span></div>)}</div></Card>
    </>
  );
}
