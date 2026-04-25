import { PageHeader } from "@/components/app/page-header";
import { ReceiptUpload } from "@/components/app/receipt-upload";
import { TransactionForm } from "@/components/app/transaction-form";
import { RowActions } from "@/components/app/row-actions";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { formatMad } from "@/lib/finance/money";
import { listEntities } from "@/lib/server/entities";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const [categories, transactions, entities] = await Promise.all([
    prisma.category.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }).catch(() => []),
    prisma.transaction.findMany({ where: { deletedAt: null }, include: { category: true, attachments: true, entity: true }, orderBy: { date: "desc" }, take: 80 }).catch(() => []),
    listEntities().catch(() => []),
  ]);

  return (
    <>
      <PageHeader title="Transactions" description="Universal ledger for personal, business, recurring, receipt-backed, and imported activity." badge="Core system" />
      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.2fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick add</CardTitle>
            </CardHeader>
            <TransactionForm categories={categories} entities={entities} />
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Scan receipt</CardTitle>
            </CardHeader>
            <ReceiptUpload />
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Ledger</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="grid grid-cols-[1fr_auto_auto] items-start gap-3 rounded-md bg-surface-inset p-3">
                <div>
                  <p className="text-sm font-medium">{transaction.description}</p>
                  <p className="text-xs text-muted-ledger">
                    {transaction.date.toISOString().slice(0, 10)} · {transaction.entity?.name ?? transaction.context} · {transaction.category?.name ?? "Uncategorized"}
                  </p>
                </div>
                <p className={transaction.kind === "INCOME" ? "text-sm font-semibold text-green-income" : "text-sm font-semibold text-red-risk"}>
                  {formatMad(transaction.madEquivalentCents)}
                </p>
                <RowActions id={transaction.id} resource="transactions" />
              </div>
            ))}
            {transactions.length === 0 ? <p className="text-sm text-muted-ledger">No transactions yet.</p> : null}
          </div>
        </Card>
      </section>
    </>
  );
}
