import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { formatMad } from "@/lib/finance/money";
import { netWorthSnapshot } from "@/lib/server/net-worth";

export const dynamic = "force-dynamic";

export default async function NetWorthPage() {
  const [snapshot, snapshots] = await Promise.all([
    netWorthSnapshot().catch(() => ({ assetsCents: 0, liabilitiesCents: 0, netWorthCents: 0, items: [] as Awaited<ReturnType<typeof netWorthSnapshot>>["items"] })),
    prisma.netWorthSnapshot.findMany({ orderBy: { snapshotDate: "desc" }, take: 12 }).catch(() => []),
  ]);
  return (
    <>
      <PageHeader title="Net worth" description="Assets, liabilities, business equity, vehicles, electronics, debts, and point-in-time snapshots." badge="Wealth" />
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Assets" value={formatMad(snapshot.assetsCents)} tone="income" />
        <MetricCard label="Liabilities" value={formatMad(snapshot.liabilitiesCents)} tone="risk" />
        <MetricCard label="Net worth" value={formatMad(snapshot.netWorthCents)} tone="plan" />
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Items</CardTitle></CardHeader><div className="space-y-2">{snapshot.items.map((item) => <div key={item.id} className="flex justify-between rounded-md bg-surface-inset p-3"><span className="text-sm">{item.name}</span><span className="text-sm font-semibold">{formatMad(item.madEquivalentCents)}</span></div>)}</div></Card>
        <Card><CardHeader><CardTitle>Snapshots</CardTitle></CardHeader><div className="space-y-2">{snapshots.map((entry) => <div key={entry.id} className="flex justify-between rounded-md bg-surface-inset p-3"><span className="text-sm">{entry.snapshotDate.toISOString().slice(0, 10)}</span><span className="text-sm font-semibold">{formatMad(entry.netWorthCents)}</span></div>)}</div></Card>
      </section>
    </>
  );
}
