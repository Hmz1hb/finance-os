import { differenceInCalendarDays } from "date-fns";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { formatMad } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

export default async function BusinessPage() {
  const [income, expenses, invoices, clients] = await Promise.all([
    prisma.transaction.aggregate({ where: { entityId: "uk_ltd", kind: "INCOME", deletedAt: null }, _sum: { madEquivalentCents: true } }).catch(() => null),
    prisma.transaction.aggregate({ where: { entityId: "uk_ltd", kind: "EXPENSE", deletedAt: null }, _sum: { madEquivalentCents: true } }).catch(() => null),
    prisma.invoice.findMany({ where: { deletedAt: null }, include: { client: true }, orderBy: { dueDate: "asc" }, take: 20 }).catch(() => []),
    prisma.client.findMany({ where: { deletedAt: null }, include: { transactions: true }, take: 20 }).catch(() => []),
  ]);
  const revenue = income?._sum.madEquivalentCents ?? 0;
  const costs = expenses?._sum.madEquivalentCents ?? 0;

  return (
    <>
      <PageHeader title="Business command center" description="PROPD Ltd, WebSolution.ma, Fiverr, subscriptions, invoices, contractors, and tax exposure." badge="Business mode" />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Revenue" value={formatMad(revenue)} tone="income" />
        <MetricCard label="Expenses" value={formatMad(costs)} tone="risk" />
        <MetricCard label="Profit" value={formatMad(revenue - costs)} />
        <MetricCard label="Clients" value={`${clients.length}`} tone="plan" />
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Outstanding invoices</CardTitle></CardHeader>
          <div className="space-y-2">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="rounded-md bg-surface-inset p-3">
                <div className="flex justify-between gap-3">
                  <p className="text-sm font-medium">{invoice.invoiceNumber} · {invoice.client?.name ?? invoice.source}</p>
                  <p className="text-sm font-semibold">{formatMad(invoice.madEquivalentCents)}</p>
                </div>
                <p className="mt-1 text-xs text-muted-ledger">
                  {invoice.status} · {invoice.dueDate ? `${Math.max(0, differenceInCalendarDays(new Date(), invoice.dueDate))} days aged` : "No due date"}
                </p>
              </div>
            ))}
            {invoices.length === 0 ? <p className="text-sm text-muted-ledger">No invoices tracked yet.</p> : null}
          </div>
        </Card>
        <Card>
          <CardHeader><CardTitle>Client directory</CardTitle></CardHeader>
          <div className="space-y-2">
            {clients.map((client) => (
              <div key={client.id} className="flex items-center justify-between rounded-md bg-surface-inset p-3">
                <div>
                  <p className="text-sm font-medium">{client.name}</p>
                  <p className="text-xs text-muted-ledger">{client.company ?? client.email ?? client.currency}</p>
                </div>
                <p className="text-xs text-muted-ledger">{client.transactions.length} tx</p>
              </div>
            ))}
            {clients.length === 0 ? <p className="text-sm text-muted-ledger">Clients will appear as you add revenue and invoices.</p> : null}
          </div>
        </Card>
      </section>
    </>
  );
}
