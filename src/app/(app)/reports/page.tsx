import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardSummary } from "@/lib/server/analytics";
import { calculateFinancialHealthScore } from "@/lib/server/health";
import { formatMoney } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [summary, health] = await Promise.all([
    dashboardSummary().catch(() => null),
    calculateFinancialHealthScore().catch(() => null),
  ]);
  return (
    <>
      <PageHeader title="Reports & analytics" description="Monthly, quarterly, yearly reports, P&L, spending analysis, category trends, exports, and health score." badge="Analytics" />
      <section className="grid gap-3 sm:grid-cols-4">
        <MetricCard label="Income" value={formatMoney(summary?.incomeCents ?? 0)} tone="income" />
        <MetricCard label="Expenses" value={formatMoney(summary?.expenseCents ?? 0)} tone="risk" />
        <MetricCard label="Savings rate" value={`${summary?.savingsRate ?? 0}%`} />
        <MetricCard label="Health score" value={`${health?.score ?? 0}/100`} tone="plan" />
      </section>
      <Card className="mt-4">
        <CardHeader><CardTitle>Financial health breakdown</CardTitle></CardHeader>
        <pre className="overflow-auto rounded-md bg-surface-inset p-3 text-xs text-muted-ledger">{JSON.stringify(health?.breakdown ?? {}, null, 2)}</pre>
      </Card>
    </>
  );
}
