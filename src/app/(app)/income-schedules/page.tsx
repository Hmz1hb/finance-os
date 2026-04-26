import { RecurringRuleType } from "@prisma/client";
import { IncomeScheduleForm } from "@/components/app/income-schedule-form";
import { PageHeader } from "@/components/app/page-header";
import { RowActions } from "@/components/app/row-actions";
import { RecurringRuleRow } from "@/components/app/recurring-rule-row";
import { ExpectedIncomeSettleButton } from "@/components/app/expected-income-settle-button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { listEntities } from "@/lib/server/entities";
import { formatMad } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

export default async function IncomeSchedulesPage() {
  const [entities, rules, expected] = await Promise.all([
    listEntities().catch(() => []),
    prisma.recurringRule.findMany({
      where: {
        deletedAt: null,
        ruleType: { in: [RecurringRuleType.EXPECTED_INCOME, RecurringRuleType.RECEIVABLE] },
      },
      include: { entity: true },
      orderBy: { nextDueDate: "asc" },
      take: 80,
    }).catch(() => []),
    prisma.expectedIncome.findMany({ where: { status: { in: ["FORECAST", "DUE"] } }, include: { entity: true }, orderBy: { dueDate: "asc" }, take: 30 }).catch(() => []),
  ]);

  return (
    <>
      <PageHeader title="Expected income" description="Forecast fixed and irregular inflows before money lands, including every-15-days schedules." badge="Cash in" />
      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>New schedule</CardTitle></CardHeader>
          <IncomeScheduleForm entities={entities} />
        </Card>
        <Card>
          <CardHeader><CardTitle>Upcoming expected cash</CardTitle></CardHeader>
          <div className="space-y-2">
            {expected.map((item) => (
              <div key={item.id} className="rounded-md bg-surface-inset p-3">
                <div className="flex justify-between gap-3">
                  <p className="text-sm font-medium">{item.description}</p>
                  <div className="flex items-start gap-2">
                    <p className="text-sm font-semibold text-green-income">{formatMad(item.madEquivalentCents)}</p>
                    <RowActions id={item.id} resource="expected-income" />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-ledger">{item.entity.name} · due {item.dueDate.toISOString().slice(0, 10)} · {item.counterparty ?? "No counterparty"}</p>
                  <ExpectedIncomeSettleButton id={item.id} />
                </div>
              </div>
            ))}
            {expected.length === 0 ? <p className="text-sm text-muted-ledger">No expected income yet.</p> : null}
          </div>
        </Card>
      </section>
      <Card className="mt-4">
        <CardHeader><CardTitle>Recurring rules</CardTitle></CardHeader>
        <div className="grid gap-2 md:grid-cols-2">
          {rules.map((rule) => (
            <RecurringRuleRow key={rule.id} rule={rule} />
          ))}
        </div>
      </Card>
    </>
  );
}
