import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { formatMad } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

export default async function NetWorthPage() {
  const [items, snapshots] = await Promise.all([
    prisma.netWorthItem.findMany({ where: { deletedAt: null }, orderBy: { kind: "asc" } }).catch(() => []),
    prisma.netWorthSnapshot.findMany({ orderBy: { snapshotDate: "desc" }, take: 12 }).catch(() => []),
  ]);
  const assets = items.filter((item) => item.kind === "ASSET").reduce((sum, item) => sum + item.madEquivalentCents, 0);
  const liabilities = items.filter((item) => item.kind === "LIABILITY").reduce((sum, item) => sum + item.madEquivalentCents, 0);
  return (
    <>
      <PageHeader title="Net worth" description="Assets, liabilities, business equity, vehicles, electronics, debts, and point-in-time snapshots." badge="Wealth" />
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Assets" value={formatMad(assets)} tone="income" />
        <MetricCard label="Liabilities" value={formatMad(liabilities)} tone="risk" />
        <MetricCard label="Net worth" value={formatMad(assets - liabilities)} tone="plan" />
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Items</CardTitle></CardHeader><div className="space-y-2">{items.map((item) => <div key={item.id} className="flex justify-between rounded-md bg-surface-inset p-3"><span className="text-sm">{item.name}</span><span className="text-sm font-semibold">{formatMad(item.madEquivalentCents)}</span></div>)}</div></Card>
        <Card><CardHeader><CardTitle>Snapshots</CardTitle></CardHeader><div className="space-y-2">{snapshots.map((snapshot) => <div key={snapshot.id} className="flex justify-between rounded-md bg-surface-inset p-3"><span className="text-sm">{snapshot.snapshotDate.toISOString().slice(0, 10)}</span><span className="text-sm font-semibold">{formatMad(snapshot.netWorthCents)}</span></div>)}</div></Card>
      </section>
    </>
  );
}
