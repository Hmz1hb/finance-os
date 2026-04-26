import { PageHeader } from "@/components/app/page-header";
import { ReceiptUpload } from "@/components/app/receipt-upload";
import { TransactionForm } from "@/components/app/transaction-form";
import { TransactionsLedger, type LedgerTransaction } from "@/components/app/transactions-ledger";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { listEntities } from "@/lib/server/entities";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function TransactionsPage() {
  const [categories, transactions, entities] = await Promise.all([
    prisma.category.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }).catch(() => []),
    // Symbolic drop from 80 -> 50: the rest is reachable through the cursor-paginated
    // "Load more" button + search box on the client component below.
    prisma.transaction
      .findMany({
        where: { deletedAt: null },
        include: { category: true, attachments: true, entity: true },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        take: PAGE_SIZE + 1,
      })
      .catch(() => []),
    listEntities().catch(() => []),
  ]);

  const hasMore = transactions.length > PAGE_SIZE;
  const initialRows = (hasMore ? transactions.slice(0, PAGE_SIZE) : transactions).map((tx) => ({
    ...tx,
    date: tx.date.toISOString(),
  })) as unknown as LedgerTransaction[];
  const initialNextCursor = hasMore ? initialRows[initialRows.length - 1]?.id ?? null : null;
  // Captured server-side so SSR + first hydration agree on the
  // "Scheduled" badge cutoff without a setState-in-effect dance.
  const serverNowMs = new Date().getTime();

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
          <TransactionsLedger
            initial={initialRows}
            initialNextCursor={initialNextCursor}
            categories={categories}
            entities={entities}
            serverNowMs={serverNowMs}
          />
        </Card>
      </section>
    </>
  );
}
