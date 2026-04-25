import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { formatMoney } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

export default async function TaxPage() {
  const [deadlines, estimates] = await Promise.all([
    prisma.taxDeadline.findMany({ orderBy: { dueDate: "asc" }, take: 20 }).catch(() => []),
    prisma.taxEstimate.findMany({ orderBy: { periodEnd: "desc" }, take: 8 }).catch(() => []),
  ]);
  return (
    <>
      <PageHeader title="Tax & compliance" description="Morocco auto-entrepreneur, UK corporation tax estimates, VAT readiness, and deadline reminders." badge="Compliance" />
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Deadlines" value={`${deadlines.length}`} tone="deadline" />
        <MetricCard label="Latest estimate" value={formatMoney(estimates[0]?.estimatedTaxCents ?? 0)} tone="risk" />
        <MetricCard label="Jurisdictions" value="MA / UK" />
      </section>
      <Card className="mt-4">
        <CardHeader><CardTitle>Tax calendar</CardTitle></CardHeader>
        <div className="space-y-2">
          {deadlines.map((item) => <div key={item.id} className="rounded-md bg-surface-inset p-3 text-sm">{item.title} · {item.jurisdiction} · {item.dueDate.toISOString().slice(0, 10)}</div>)}
          {deadlines.length === 0 ? <p className="text-sm text-muted-ledger">Seed or add deadlines for upcoming tax events.</p> : null}
        </div>
      </Card>
    </>
  );
}
