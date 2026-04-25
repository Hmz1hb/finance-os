import { ArrowDownRight, ArrowUpRight, Landmark, PiggyBank, Wallet } from "lucide-react";
import { CategoryPie } from "@/components/charts/category-pie";
import { MonthlyBars } from "@/components/charts/monthly-bars";
import { MetricCard } from "@/components/app/metric-card";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { dashboardSummary } from "@/lib/server/analytics";
import { formatMoney } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const summary = await dashboardSummary().catch(() => null);

  if (!summary) {
    return (
      <>
        <PageHeader title="Dashboard" description="Connect PostgreSQL and run Prisma migrations to load live finance data." badge="Setup" />
        <Card>Database is not reachable yet. Configure `DATABASE_URL`, run migrations, then seed the app.</Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Today’s cash position"
        description="A combined personal and business view of income, expenses, obligations, goals, debt, and runway."
        badge="Combined mode"
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Income YTD" value={formatMoney(summary.incomeCents)} tone="income" icon={<ArrowUpRight className="h-5 w-5" />} />
        <MetricCard label="Expenses YTD" value={formatMoney(summary.expenseCents)} tone="risk" icon={<ArrowDownRight className="h-5 w-5" />} />
        <MetricCard label="Net cash flow" value={formatMoney(summary.netCents)} detail={`${summary.savingsRate}% savings rate`} icon={<Wallet className="h-5 w-5" />} />
        <MetricCard label="Net worth" value={formatMoney(summary.netWorthCents)} tone="plan" icon={<Landmark className="h-5 w-5" />} />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Monthly income vs expenses</CardTitle>
          </CardHeader>
          <MonthlyBars data={summary.monthly} />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Spending pressure</CardTitle>
          </CardHeader>
          <CategoryPie data={summary.categoryBreakdown} />
        </Card>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Recent ledger</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {summary.recentTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between rounded-md bg-surface-inset px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{transaction.description}</p>
                  <p className="text-xs text-muted-ledger">{transaction.category?.name ?? transaction.context}</p>
                </div>
                <p className={transaction.kind === "INCOME" ? "text-sm font-semibold text-green-income" : "text-sm font-semibold text-red-risk"}>
                  {formatMoney(transaction.madEquivalentCents)}
                </p>
              </div>
            ))}
            {summary.recentTransactions.length === 0 ? <p className="text-sm text-muted-ledger">No transactions yet. Add your first income or expense.</p> : null}
          </div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Allocation rail</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <Rail label="Must pay" value={summary.monthlyDebtCents + summary.subscriptionBurnCents} color="bg-red-risk" />
            <Rail label="Should fund" value={summary.goals.reduce((sum, goal) => sum + Math.max(0, goal.targetAmountCents - goal.currentSavedCents), 0) / 12} color="bg-orange-deadline" />
            <Rail label="Emergency runway" value={summary.netWorthCents} color="bg-purple-plan" />
            <div className="rounded-md bg-surface-inset p-3">
              <PiggyBank className="mb-2 h-5 w-5 text-green-income" />
              <p className="text-sm font-medium">Savings rate target</p>
              <Progress value={summary.savingsRate} className="mt-3" />
            </div>
          </div>
        </Card>
      </section>
    </>
  );
}

function Rail({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-ledger">{formatMoney(Math.round(value))}</span>
      </div>
      <div className="h-2 rounded-full bg-surface-inset">
        <div className={`h-full max-w-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(8, Math.abs(value) / 100000))}%` }} />
      </div>
    </div>
  );
}
