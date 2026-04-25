import { PageHeader } from "@/components/app/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { formatMoney } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

export default async function BusinessExpensesPage() {
  const rows = await prisma.transaction.findMany({
    where: { context: "BUSINESS", kind: "EXPENSE", deletedAt: null },
    include: { category: true },
    orderBy: { date: "desc" },
    take: 100,
  }).catch(() => []);
  return (
    <>
      <PageHeader title="Business expenses" description="Infrastructure, SaaS, payment fees, marketing, professional services, office, communication, and travel." badge="Costs" />
      <Card>
        <CardHeader><CardTitle>Expense ledger</CardTitle></CardHeader>
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="flex justify-between gap-4 rounded-md bg-surface-inset p-3">
              <div><p className="text-sm font-medium">{row.description}</p><p className="text-xs text-muted-ledger">{row.category?.name ?? row.counterparty ?? "Uncategorized"} · {row.taxDeductible ? "tax deductible" : "not marked deductible"}</p></div>
              <p className="text-sm font-semibold text-red-risk">{formatMoney(row.madEquivalentCents)}</p>
            </div>
          ))}
          {rows.length === 0 ? <p className="text-sm text-muted-ledger">Business costs will appear here.</p> : null}
        </div>
      </Card>
    </>
  );
}
