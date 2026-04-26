import { GoalForm } from "@/components/app/goal-form";
import { GoalRow } from "@/components/app/goal-row";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { listEntities } from "@/lib/server/entities";

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
          {goals.map((goal) => (
            <GoalRow key={goal.id} goal={goal} entities={entities} />
          ))}
          {goals.length === 0 ? <p className="text-sm text-muted-ledger">No goals yet.</p> : null}
        </div>
      </section>
    </>
  );
}
