import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { prisma } from "@/lib/server/db";
import { formatMoney } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const goals = await prisma.goal.findMany({ where: { deletedAt: null }, orderBy: [{ priority: "asc" }, { name: "asc" }] }).catch(() => []);
  return (
    <>
      <PageHeader title="Financial goals" description="Emergency fund, Portugal D7 Visa, investments, business reserves, upgrades, travel, and milestone progress." badge="Planning" />
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {goals.map((goal) => {
          const pct = (goal.currentSavedCents / Math.max(goal.targetAmountCents, 1)) * 100;
          return (
            <Card key={goal.id}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div><h2 className="text-sm font-semibold">{goal.name}</h2><p className="mt-1 text-xs text-muted-ledger">{goal.category} · priority {goal.priority}</p></div>
                <span className="text-sm font-semibold">{Math.round(pct)}%</span>
              </div>
              <Progress value={pct} />
              <p className="mt-3 text-xs text-muted-ledger">{formatMoney(goal.currentSavedCents, goal.currency)} / {formatMoney(goal.targetAmountCents, goal.currency)}</p>
            </Card>
          );
        })}
      </section>
    </>
  );
}
