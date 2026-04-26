import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { formatMad, formatMoney } from "@/lib/finance/money";
import { getMadRate } from "@/lib/server/rates";

export const dynamic = "force-dynamic";

export default async function PersonalPage() {
  const [income, expenses, goals, loans] = await Promise.all([
    prisma.transaction.aggregate({ where: { entityId: "morocco_personal", kind: "INCOME", deletedAt: null }, _sum: { madEquivalentCents: true } }).catch(() => null),
    prisma.transaction.aggregate({ where: { entityId: "morocco_personal", kind: "EXPENSE", deletedAt: null }, _sum: { madEquivalentCents: true } }).catch(() => null),
    prisma.goal.findMany({ where: { deletedAt: null }, orderBy: { priority: "asc" }, take: 6 }).catch(() => []),
    prisma.loan.findMany({
      where: { deletedAt: null, kind: { not: "OWED_TO_ME" } },
      select: { remainingBalanceCents: true, currency: true },
    }).catch(() => []),
  ]);
  const personalIncome = income?._sum.madEquivalentCents ?? 0;
  const personalExpenses = expenses?._sum.madEquivalentCents ?? 0;

  // FX-convert each loan to MAD before summing; raw cents across currencies are not addable.
  // Falls back to 1 if the rate matrix isn't ready yet so the page still renders.
  let debtRemainingCents = 0;
  for (const loan of loans) {
    const rate = await getMadRate(loan.currency).catch(() => 1);
    debtRemainingCents += Math.round(loan.remainingBalanceCents * rate);
  }

  return (
    <>
      <PageHeader title="Personal finance" description="Household spending, subscriptions, vehicles, health, giving, debt, emergency fund, and life goals." badge="Personal mode" />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Income" value={formatMad(personalIncome)} tone="income" />
        <MetricCard label="Spending" value={formatMad(personalExpenses)} tone="risk" />
        <MetricCard label="Debt remaining" value={formatMad(debtRemainingCents)} tone="deadline" />
        <MetricCard label="Savings capacity" value={formatMad(personalIncome - personalExpenses)} />
      </section>
      <Card className="mt-4">
        <CardHeader><CardTitle>Active goals</CardTitle></CardHeader>
        <div className="grid gap-2 md:grid-cols-2">
          {goals.map((goal) => <div key={goal.id} className="rounded-md bg-surface-inset p-3"><p className="text-sm font-medium">{goal.name}</p><p className="text-xs text-muted-ledger">{formatMoney(goal.currentSavedCents, goal.currency)} / {formatMoney(goal.targetAmountCents, goal.currency)}</p></div>)}
        </div>
      </Card>
    </>
  );
}
