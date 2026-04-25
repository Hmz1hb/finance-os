import { PageHeader } from "@/components/app/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { formatMoney } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

export default async function PersonalIncomePage() {
  const rows = await prisma.transaction.findMany({ where: { context: "PERSONAL", kind: "INCOME", deletedAt: null }, include: { category: true }, orderBy: { date: "desc" }, take: 100 }).catch(() => []);
  return (
    <>
      <PageHeader title="Personal income" description="Salary from business, side income, gifts, refunds, and other personal inflows." badge="Income" />
      <Card><CardHeader><CardTitle>Income ledger</CardTitle></CardHeader><div className="space-y-2">{rows.map((row) => <div key={row.id} className="flex justify-between rounded-md bg-surface-inset p-3"><span className="text-sm">{row.description}</span><span className="text-sm font-semibold text-green-income">{formatMoney(row.madEquivalentCents)}</span></div>)}</div></Card>
    </>
  );
}
