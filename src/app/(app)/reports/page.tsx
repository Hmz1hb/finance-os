import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardSummary } from "@/lib/server/analytics";
import { calculateFinancialHealthScore } from "@/lib/server/health";
import { formatMad } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

type Breakdown = {
  savingsRate?: number;
  emergencyFund?: number;
  debtToIncome?: number;
  goalProgress?: number;
  incomeDiversification?: number;
};

function pct(value: number | undefined) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${Math.round(n)}%`;
}

export default async function ReportsPage() {
  const [summary, health] = await Promise.all([
    dashboardSummary().catch(() => null),
    calculateFinancialHealthScore().catch(() => null),
  ]);
  const breakdown = ((health?.breakdown ?? {}) as unknown as Breakdown) ?? ({} as Breakdown);
  return (
    <>
      <PageHeader title="Reports & analytics" description="Monthly, quarterly, yearly reports, P&L, spending analysis, category trends, exports, and health score." badge="Analytics" />
      <section className="grid gap-3 sm:grid-cols-4">
        <MetricCard label="Income" value={formatMad(summary?.incomeCents ?? 0)} tone="income" />
        <MetricCard label="Expenses" value={formatMad(summary?.expenseCents ?? 0)} tone="risk" />
        <MetricCard label="Savings rate" value={`${summary?.savingsRate ?? 0}%`} />
        <MetricCard label="Health score" value={`${health?.score ?? 0}/100`} tone="plan" />
      </section>
      <Card className="mt-4">
        <CardHeader><CardTitle>Financial health breakdown</CardTitle></CardHeader>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Savings rate" value={pct(breakdown.savingsRate)} tone="income" />
          <MetricCard label="Debt to income" value={pct(breakdown.debtToIncome)} tone="risk" />
          <MetricCard label="Goal progress" value={pct(breakdown.goalProgress)} tone="plan" />
          <MetricCard label="Emergency fund" value={pct(breakdown.emergencyFund)} tone="deadline" />
          <MetricCard label="Income diversification" value={pct(breakdown.incomeDiversification)} />
        </div>
      </Card>
    </>
  );
}
