import { addDays } from "date-fns";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { RowActions } from "@/components/app/row-actions";
import { SubscriptionForm } from "@/components/app/subscription-form";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { listEntities } from "@/lib/server/entities";
import { formatMad, formatMoney } from "@/lib/finance/money";

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
              <div key={sub.id} className="flex items-start justify-between rounded-md bg-surface-inset p-3">
                <div>
                  <p className="text-sm font-medium">{sub.name}</p>
                  <p className="text-xs text-muted-ledger">{sub.context} · {sub.category} · next {sub.nextBillingDate.toISOString().slice(0, 10)}</p>
                </div>
                <div className="flex items-start gap-2">
                  <p className="text-sm font-semibold">{formatMoney(sub.amountCents, sub.currency)}</p>
                  <RowActions id={sub.id} resource="subscriptions" />
                </div>
              </div>
            ))}
            {subs.length === 0 ? <p className="text-sm text-muted-ledger">No subscriptions tracked yet.</p> : null}
          </div>
        </Card>
      </section>
    </>
  );
}
