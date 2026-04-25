import { PageHeader } from "@/components/app/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { formatMad } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

export default async function BusinessIncomePage() {
  const rows = await prisma.transaction.findMany({
    where: { entityId: "uk_ltd", kind: "INCOME", deletedAt: null },
    include: { client: true, invoice: true, category: true },
    orderBy: { date: "desc" },
    take: 100,
  }).catch(() => []);
  return (
    <>
      <PageHeader title="Business income" description="Revenue by source: AzloTV/Filmsa, PROPD client projects, Fiverr, WebSolution.ma, and one-off work." badge="Revenue" />
      <Card>
        <CardHeader><CardTitle>Revenue ledger</CardTitle></CardHeader>
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="flex justify-between gap-4 rounded-md bg-surface-inset p-3">
              <div><p className="text-sm font-medium">{row.description}</p><p className="text-xs text-muted-ledger">{row.source ?? row.category?.name ?? "Other"} · {row.invoice?.status ?? row.status}</p></div>
              <p className="text-sm font-semibold text-green-income">{formatMad(row.madEquivalentCents)}</p>
            </div>
          ))}
          {rows.length === 0 ? <p className="text-sm text-muted-ledger">Add revenue from the Transactions page or import CSV history.</p> : null}
        </div>
      </Card>
    </>
  );
}
