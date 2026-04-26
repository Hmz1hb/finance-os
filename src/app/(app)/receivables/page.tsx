import { ReceivableForm } from "@/components/app/receivable-form";
import { ReceivableRow } from "@/components/app/receivable-row";
import { MetricCard } from "@/components/app/metric-card";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { listEntities } from "@/lib/server/entities";
import { receivableStatus } from "@/lib/server/cashflows";
import { formatMad } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

export default async function ReceivablesPage() {
  const [entities, receivables] = await Promise.all([
    listEntities().catch(() => []),
    prisma.receivable.findMany({
      where: { deletedAt: null },
      include: { entity: true, payments: true },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 100,
    }).catch(() => []),
  ]);
  const open = receivables.filter((item) => !["PAID", "CANCELLED"].includes(receivableStatus(item)));
  const openCents = open.reduce((sum, item) => sum + Math.max(0, item.madEquivalentCents - item.paidAmountCents), 0);
  const overdue = open.filter((item) => item.dueDate && item.dueDate < new Date());

  return (
    <>
      <PageHeader title="Receivables" description="Client invoices, business receivables, and personal IOUs people need to pay you." badge="Owed to me" />
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Open receivables" value={formatMad(openCents)} tone="income" />
        <MetricCard label="Overdue" value={`${overdue.length}`} tone="risk" />
        <MetricCard label="Tracked items" value={`${receivables.length}`} tone="plan" />
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>Add money owed to you</CardTitle></CardHeader>
          <ReceivableForm entities={entities} />
        </Card>
        <Card>
          <CardHeader><CardTitle>Open ledger</CardTitle></CardHeader>
          <div className="space-y-3">
            {receivables.map((item) => (
              <ReceivableRow
                key={item.id}
                receivable={item}
                status={receivableStatus(item)}
                entities={entities}
              />
            ))}
            {receivables.length === 0 ? <p className="text-sm text-muted-ledger">No receivables tracked yet.</p> : null}
          </div>
        </Card>
      </section>
    </>
  );
}
