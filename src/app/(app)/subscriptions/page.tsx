import { addDays } from "date-fns";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { SubscriptionForm } from "@/components/app/subscription-form";
import { SubscriptionRow } from "@/components/app/subscription-row";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { listEntities } from "@/lib/server/entities";
import { formatMad } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const [subs, entities] = await Promise.all([
    prisma.subscription.findMany({ where: { deletedAt: null }, orderBy: { nextBillingDate: "asc" } }).catch(() => []),
    listEntities().catch(() => []),
  ]);
  const active = subs.filter((sub) => sub.status === "ACTIVE");
  const monthlyBurn = active.reduce((sum, sub) => sum + (sub.billingCycle === "YEARLY" ? Math.round(sub.madEquivalentCents / 12) : sub.madEquivalentCents), 0);
  const renewSoon = active.filter((sub) => sub.nextBillingDate <= addDays(new Date(), 7));
  return (
    <>
      <PageHeader title="Subscriptions manager" description="Personal and business recurring charges, burn rate, billing calendar, and cancellation tracking." badge="Recurring" />
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Monthly burn" value={formatMad(monthlyBurn)} tone="deadline" />
        <MetricCard label="Annualized cost" value={formatMad(monthlyBurn * 12)} tone="risk" />
        <MetricCard label="Renewing this week" value={`${renewSoon.length}`} tone="plan" />
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>Add subscription</CardTitle></CardHeader>
          <SubscriptionForm entities={entities} />
        </Card>
        <Card>
          <CardHeader><CardTitle>What am I paying for?</CardTitle></CardHeader>
          <div className="space-y-2">
            {subs.map((sub) => (
              <SubscriptionRow key={sub.id} subscription={sub} entities={entities} />
            ))}
            {subs.length === 0 ? <p className="text-sm text-muted-ledger">No subscriptions tracked yet.</p> : null}
          </div>
        </Card>
      </section>
    </>
  );
}
