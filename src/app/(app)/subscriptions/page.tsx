import { addDays } from "date-fns";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { formatMad, formatMoney } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const subs = await prisma.subscription.findMany({ where: { deletedAt: null }, orderBy: { nextBillingDate: "asc" } }).catch(() => []);
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
      <Card className="mt-4">
        <CardHeader><CardTitle>What am I paying for?</CardTitle></CardHeader>
        <div className="space-y-2">
          {subs.map((sub) => <div key={sub.id} className="flex justify-between rounded-md bg-surface-inset p-3"><div><p className="text-sm font-medium">{sub.name}</p><p className="text-xs text-muted-ledger">{sub.context} · {sub.category} · next {sub.nextBillingDate.toISOString().slice(0, 10)}</p></div><p className="text-sm font-semibold">{formatMoney(sub.madEquivalentCents, sub.currency)}</p></div>)}
          {subs.length === 0 ? <p className="text-sm text-muted-ledger">Add recurring services via API or transaction templates to track burn rate.</p> : null}
        </div>
      </Card>
    </>
  );
}
