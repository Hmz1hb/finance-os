import Link from "next/link";
import { ArrowDownRight, BanknoteArrowUp, CalendarClock, Landmark, PanelTop, Wallet } from "lucide-react";
import { MetricCard } from "@/components/app/metric-card";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cockpitSummary } from "@/lib/server/cockpit";
import { entityIdFromSearch, entityLabel } from "@/lib/server/entities";
import { formatMad, formatMoney } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  const params = await searchParams;
  const entityId = entityIdFromSearch(params.entity);
  const summary = await cockpitSummary(entityId).catch(() => null);
  const activeEntity = entityId ? summary?.entities.find((entity) => entity.id === entityId) : null;

  if (!summary) {
    return (
      <>
        <PageHeader title="Cash cockpit" description="Connect PostgreSQL and run Prisma migrations to load live finance data." badge="Setup" />
        <Card>Database is not reachable yet. Configure `DATABASE_URL`, run migrations, then seed the app.</Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`${entityLabel(activeEntity)} cash cockpit`}
        description="Entity-led view of cash now, expected inflows, receivables, tax reserves, owner pay, and upcoming obligations."
        badge={activeEntity ? activeEntity.baseCurrency : "Combined"}
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Cash now" value={formatMad(summary.cashCents)} icon={<Wallet className="h-5 w-5" />} />
        <MetricCard label="Expected 30d" value={formatMad(summary.expectedIncomeCents)} tone="income" icon={<BanknoteArrowUp className="h-5 w-5" />} />
        <MetricCard label="Receivables open" value={formatMad(summary.receivableOpenCents)} tone="plan" icon={<PanelTop className="h-5 w-5" />} />
        <MetricCard label="Tax reserve" value={formatMad(summary.taxReserveCents)} tone="deadline" icon={<Landmark className="h-5 w-5" />} />
        <MetricCard label="Overdue owed" value={`${summary.overdueReceivableCount}`} tone="risk" icon={<ArrowDownRight className="h-5 w-5" />} />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Expected cash and receivables</CardTitle>
            <Link href="/income-schedules" className="text-xs text-blue-ledger">Manage schedules</Link>
          </CardHeader>
          <div className="space-y-2">
            {summary.expectedIncome.map((item) => (
              <div key={item.id} className="flex justify-between gap-3 rounded-md bg-surface-inset p-3">
                <div>
                  <p className="text-sm font-medium">{item.description}</p>
                  <p className="text-xs text-muted-ledger">{item.entity.name} · due {item.dueDate.toISOString().slice(0, 10)} · {item.counterparty ?? "No counterparty"}</p>
                </div>
                <p className="text-sm font-semibold text-green-income">{formatMad(item.madEquivalentCents)}</p>
              </div>
            ))}
            {summary.receivables.slice(0, 5).map((item) => (
              <div key={item.id} className="flex justify-between gap-3 rounded-md bg-surface-inset p-3">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-ledger">{item.entity.name} · {item.counterparty} · {item.status}</p>
                </div>
                <p className="text-sm font-semibold">{formatMad(Math.max(0, item.madEquivalentCents - item.paidAmountCents))}</p>
              </div>
            ))}
            {summary.expectedIncome.length === 0 && summary.receivables.length === 0 ? <p className="text-sm text-muted-ledger">No expected cash or receivables yet.</p> : null}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming obligations</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-ledger" />
          </CardHeader>
          <div className="space-y-2">
            {summary.recurringRules.map((rule) => (
              <div key={rule.id} className="rounded-md bg-surface-inset p-3">
                <div className="flex justify-between gap-3">
                  <p className="text-sm font-medium">{rule.title}</p>
                  <p className="text-sm font-semibold">{formatMoney(rule.amountCents, rule.currency)}</p>
                </div>
                <p className="text-xs text-muted-ledger">{rule.entity.name} · {rule.ruleType} · next {rule.nextDueDate.toISOString().slice(0, 10)}</p>
              </div>
            ))}
            {summary.reserves.map((reserve) => (
              <div key={reserve.id} className="rounded-md bg-surface-inset p-3">
                <div className="flex justify-between gap-3">
                  <p className="text-sm font-medium">Tax reserve · {reserve.entity.name}</p>
                  <p className="text-sm font-semibold text-orange-deadline">{formatMoney(reserve.reserveCents, reserve.currency)}</p>
                </div>
                <p className="text-xs text-muted-ledger">{reserve.periodStart.toISOString().slice(0, 10)} to {reserve.periodEnd.toISOString().slice(0, 10)}</p>
              </div>
            ))}
            {summary.recurringRules.length === 0 && summary.reserves.length === 0 ? <p className="text-sm text-muted-ledger">No upcoming obligations configured.</p> : null}
          </div>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Owner pay</CardTitle></CardHeader>
          <div className="space-y-2">
            {summary.ownerPay.map((item) => (
              <div key={item.id} className="rounded-md bg-surface-inset p-3">
                <div className="flex justify-between gap-3">
                  <p className="text-sm font-medium">{item.paymentType}</p>
                  <p className="text-sm font-semibold">{formatMad(item.madEquivalentCents)}</p>
                </div>
                <p className="text-xs text-muted-ledger">{item.fromEntity.name} to {item.toEntity.name} · {item.date.toISOString().slice(0, 10)}</p>
              </div>
            ))}
            {summary.ownerPay.length === 0 ? <p className="text-sm text-muted-ledger">No owner compensation recorded yet.</p> : null}
          </div>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent ledger</CardTitle></CardHeader>
          <div className="space-y-2">
            {summary.transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between rounded-md bg-surface-inset px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{transaction.description}</p>
                  <p className="text-xs text-muted-ledger">{transaction.entity?.name ?? transaction.context} · {transaction.category?.name ?? "Uncategorized"}</p>
                </div>
                <p className={transaction.kind === "INCOME" ? "text-sm font-semibold text-green-income" : "text-sm font-semibold text-red-risk"}>
                  {formatMad(transaction.madEquivalentCents)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </>
  );
}
