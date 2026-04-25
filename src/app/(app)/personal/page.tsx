import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { formatMad, formatMoney } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

export default async function PersonalPage() {
  const [income, expenses, goals, loans] = await Promise.all([
    prisma.transaction.aggregate({ where: { entityId: "morocco_personal", kind: "INCOME", deletedAt: null }, _sum: { madEquivalentCents: true } }).catch(() => null),
    prisma.transaction.aggregate({ where: { entityId: "morocco_personal", kind: "EXPENSE", deletedAt: null }, _sum: { madEquivalentCents: true } }).catch(() => null),
    prisma.goal.findMany({ where: { deletedAt: null }, orderBy: { priority: "asc" }, take: 6 }).catch(() => []),
    prisma.loan.aggregate({ where: { deletedAt: null }, _sum: { remainingBalanceCents: true } }).catch(() => null),
  ]);
  const personalIncome = income?._sum.madEquivalentCents ?? 0;
  const personalExpenses = expenses?._sum.madEquivalentCents ?? 0;
  return (
    <>
      <PageHeader title="Personal finance" description="Household spending, subscriptions, vehicles, health, giving, debt, emergency fund, and life goals." badge="Personal mode" />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Income" value={formatMad(personalIncome)} tone="income" />
        <MetricCard label="Spending" value={formatMad(personalExpenses)} tone="risk" />
        <MetricCard label="Debt remaining" value={formatMad(loans?._sum.remainingBalanceCents ?? 0)} tone="deadline" />
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
