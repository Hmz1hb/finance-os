import type { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { LoanForm } from "@/components/app/loan-form";
import { LoanStrategyToggle } from "@/components/app/loan-strategy-toggle";
import { LoanRow } from "@/components/app/loan-row";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { formatMad } from "@/lib/finance/money";
import { listEntities } from "@/lib/server/entities";
import { getMadRate } from "@/lib/server/rates";

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
  // FX-convert each loan's cents to MAD before summing — different currencies must
  // not be added together as raw cents. Use the cached/DB-backed rate matrix.
  // Falls back to 1 if the rate isn't cached so the page still renders during
  // first-boot / DB-empty states.
  const debtLoans = loans.filter((loan) => loan.kind !== "OWED_TO_ME");
  const rateByCurrency = new Map<string, number>();
  for (const loan of debtLoans) {
    if (!rateByCurrency.has(loan.currency)) {
      const rate = await getMadRate(loan.currency).catch(() => 1);
      rateByCurrency.set(loan.currency, rate);
    }
  }
  const totalDebt = debtLoans.reduce(
    (sum, loan) => sum + Math.round(loan.remainingBalanceCents * (rateByCurrency.get(loan.currency) ?? 1)),
    0,
  );
  const monthly = loans.reduce(
    (sum, loan) => sum + Math.round(loan.monthlyPaymentCents * (rateByCurrency.get(loan.currency) ?? 1)),
    0,
  );
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
              <LoanRow key={loan.id} loan={loan} entities={entities} />
            ))}
            {loans.length === 0 ? <p className="text-sm text-muted-ledger">No liabilities tracked yet. Money owed to you belongs in Receivables.</p> : null}
          </div>
        </Card>
      </section>
    </>
  );
}
