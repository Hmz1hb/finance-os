import type { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { LoanForm } from "@/components/app/loan-form";
import { LoanPaymentForm } from "@/components/app/loan-payment-form";
import { LoanStrategyToggle } from "@/components/app/loan-strategy-toggle";
import { RowActions } from "@/components/app/row-actions";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { formatMad, formatMoney } from "@/lib/finance/money";
import { listEntities } from "@/lib/server/entities";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function LoansPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams;
  const rawStrategy = resolvedSearchParams.strategy;
  const strategyValue = Array.isArray(rawStrategy) ? rawStrategy[0] : rawStrategy;
  const strategy: "snowball" | "avalanche" = strategyValue === "avalanche" ? "avalanche" : "snowball";

  const orderBy: Prisma.LoanOrderByWithRelationInput =
    strategy === "avalanche" ? { interestRate: "desc" } : { remainingBalanceCents: "asc" };

  const [loans, entities] = await Promise.all([
    prisma.loan
      .findMany({
        where: { deletedAt: null, kind: { not: "OWED_TO_ME" } },
        include: { payments: true, entity: true },
        orderBy,
      })
      .catch(() => []),
    listEntities().catch(() => []),
  ]);
  const totalDebt = loans.filter((loan) => loan.kind !== "OWED_TO_ME").reduce((sum, loan) => sum + loan.remainingBalanceCents, 0);
  const monthly = loans.reduce((sum, loan) => sum + loan.monthlyPaymentCents, 0);
  const heading = strategy === "avalanche" ? "Avalanche view" : "Snowball view";
  return (
    <>
      <PageHeader title="Loans & debt" description="Money owed by you, credit cards, BNPL, business loans, and money owed to you." badge="Debt" />
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Total debt" value={formatMad(totalDebt)} tone="risk" />
        <MetricCard label="Monthly obligation" value={formatMad(monthly)} tone="deadline" />
        <MetricCard label="Owed to me" value="Receivables" tone="income" />
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>Add liability</CardTitle></CardHeader>
          <LoanForm entities={entities} />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{heading}</CardTitle>
            <LoanStrategyToggle />
          </CardHeader>
          <div className="space-y-2">
            {loans.map((loan) => (
              <div key={loan.id} className="rounded-md bg-surface-inset p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{loan.lenderName}</p>
                    <p className="text-xs text-muted-ledger">
                      {loan.entity?.name ?? "Unassigned"} · {loan.kind} · {Number(loan.interestRate)}% · monthly {formatMoney(loan.monthlyPaymentCents, loan.currency)}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <p className="text-sm font-semibold">{formatMoney(loan.remainingBalanceCents, loan.currency)}</p>
                    <RowActions id={loan.id} resource="loans" />
                  </div>
                </div>
                <LoanPaymentForm loanId={loan.id} />
              </div>
            ))}
            {loans.length === 0 ? <p className="text-sm text-muted-ledger">No liabilities tracked yet. Money owed to you belongs in Receivables.</p> : null}
          </div>
        </Card>
      </section>
    </>
  );
}
