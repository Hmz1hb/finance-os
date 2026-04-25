import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { LoanForm } from "@/components/app/loan-form";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { formatMoney } from "@/lib/finance/money";
import { listEntities } from "@/lib/server/entities";

export const dynamic = "force-dynamic";

export default async function LoansPage() {
  const [loans, entities] = await Promise.all([
    prisma.loan.findMany({ where: { deletedAt: null, kind: { not: "OWED_TO_ME" } }, include: { payments: true, entity: true }, orderBy: { remainingBalanceCents: "desc" } }).catch(() => []),
    listEntities().catch(() => []),
  ]);
  const totalDebt = loans.filter((loan) => loan.kind !== "OWED_TO_ME").reduce((sum, loan) => sum + loan.remainingBalanceCents, 0);
  const monthly = loans.reduce((sum, loan) => sum + loan.monthlyPaymentCents, 0);
  return (
    <>
      <PageHeader title="Loans & debt" description="Money owed by you, credit cards, BNPL, business loans, and money owed to you." badge="Debt" />
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Total debt" value={formatMoney(totalDebt)} tone="risk" />
        <MetricCard label="Monthly obligation" value={formatMoney(monthly)} tone="deadline" />
        <MetricCard label="Owed to me" value="Receivables" tone="income" />
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>Add liability</CardTitle></CardHeader>
          <LoanForm entities={entities} />
        </Card>
        <Card>
          <CardHeader><CardTitle>Snowball / avalanche view</CardTitle></CardHeader>
          <div className="space-y-2">
            {loans.map((loan) => <div key={loan.id} className="rounded-md bg-surface-inset p-3"><div className="flex justify-between"><p className="text-sm font-medium">{loan.lenderName}</p><p className="text-sm font-semibold">{formatMoney(loan.remainingBalanceCents, loan.currency)}</p></div><p className="text-xs text-muted-ledger">{loan.entity?.name ?? "Unassigned"} · {loan.kind} · {Number(loan.interestRate)}% · monthly {formatMoney(loan.monthlyPaymentCents, loan.currency)}</p></div>)}
            {loans.length === 0 ? <p className="text-sm text-muted-ledger">No liabilities tracked yet. Money owed to you belongs in Receivables.</p> : null}
          </div>
        </Card>
      </section>
    </>
  );
}
