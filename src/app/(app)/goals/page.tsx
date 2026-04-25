import { GoalContributeForm } from "@/components/app/goal-contribute-form";
import { GoalForm } from "@/components/app/goal-form";
import { PageHeader } from "@/components/app/page-header";
import { RowActions } from "@/components/app/row-actions";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { prisma } from "@/lib/server/db";
import { listEntities } from "@/lib/server/entities";
import { formatMoney } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const [goals, entities] = await Promise.all([
    prisma.goal.findMany({ where: { deletedAt: null }, orderBy: [{ priority: "asc" }, { name: "asc" }] }).catch(() => []),
    listEntities().catch(() => []),
  ]);
  return (
    <>
      <PageHeader title="Financial goals" description="Emergency fund, Portugal D7 Visa, investments, business reserves, upgrades, travel, and milestone progress." badge="Planning" />
      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>Add goal</CardTitle></CardHeader>
          <GoalForm entities={entities} />
        </Card>
        <div className="grid gap-3 md:grid-cols-2">
          {goals.map((goal) => {
            const pct = (goal.currentSavedCents / Math.max(goal.targetAmountCents, 1)) * 100;
            return (
              <Card key={goal.id}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">{goal.name}</h2>
                    <p className="mt-1 text-xs text-muted-ledger">{goal.category} · priority {goal.priority}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-semibold">{Math.round(pct)}%</span>
                    <RowActions id={goal.id} resource="goals" />
                  </div>
                </div>
                <Progress value={pct} />
                <p className="mt-3 text-xs text-muted-ledger">{formatMoney(goal.currentSavedCents, goal.currency)} / {formatMoney(goal.targetAmountCents, goal.currency)}</p>
                <GoalContributeForm goalId={goal.id} />
              </Card>
            );
          })}
          {goals.length === 0 ? <p className="text-sm text-muted-ledger">No goals yet.</p> : null}
        </div>
      </section>
    </>
  );
}
