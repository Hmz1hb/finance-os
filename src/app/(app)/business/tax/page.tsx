import { Landmark, Scale } from "lucide-react";
import type { Currency } from "@prisma/client";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { TaxReserveButton } from "@/components/app/tax-reserve-button";
import { TaxRulesPanel } from "@/components/app/tax-rules-panel";
import { prisma } from "@/lib/server/db";
import { taxCockpit } from "@/lib/server/tax";
import { formatMoney } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

export default async function TaxPage() {
  const [{ uk, morocco, reserves }, deadlines, profiles] = await Promise.all([
    taxCockpit().catch(() => ({ uk: null, morocco: null, reserves: [] })),
    prisma.taxDeadline.findMany({ orderBy: { dueDate: "asc" }, take: 20 }).catch(() => []),
    prisma.taxProfile.findMany({ include: { entity: true }, orderBy: { effectiveFrom: "desc" } }).catch(() => []),
  ]);

  return (
    <>
      <PageHeader title="Tax reserve cockpit" description="Estimate exposure, show assumptions, and reserve cash without treating the app as a filing system." badge="Estimate only" />
      <section className="grid gap-3 sm:grid-cols-4">
        <MetricCard label="UK LTD estimate" value={formatMoney(uk?.estimatedTaxCents ?? 0, "GBP")} tone="risk" icon={<Scale className="h-5 w-5" />} />
        <MetricCard label="Morocco estimate" value={formatMoney(morocco?.estimatedTaxCents ?? 0, "MAD")} tone="risk" icon={<Landmark className="h-5 w-5" />} />
        <MetricCard label="UK VAT usage" value={`${Math.round(((uk?.assumptions as { vatThresholdUsage?: number } | undefined)?.vatThresholdUsage ?? 0) * 100)}%`} tone="plan" />
        <MetricCard label="Reserve records" value={`${reserves.length}`} />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <EstimateCard title="UK LTD corporation tax" estimate={uk} />
        <EstimateCard title="Morocco auto-entrepreneur" estimate={morocco} />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Tax reserves</CardTitle></CardHeader>
          <div className="mb-4 flex flex-wrap gap-2">
            <TaxReserveButton entityId="uk_ltd" label="Reserve UK LTD estimate" />
            <TaxReserveButton entityId="morocco_personal" label="Reserve Morocco estimate" />
          </div>
          <div className="space-y-2">
            {reserves.map((reserve) => (
              <div key={reserve.id} className="rounded-md bg-surface-inset p-3">
                <div className="flex justify-between gap-3">
                  <p className="text-sm font-medium">{reserve.entity.name}</p>
                  <p className="text-sm font-semibold text-orange-deadline">{formatMoney(reserve.reserveCents, reserve.currency)}</p>
                </div>
                <p className="text-xs text-muted-ledger">{reserve.status} · {reserve.periodStart.toISOString().slice(0, 10)} to {reserve.periodEnd.toISOString().slice(0, 10)}</p>
              </div>
            ))}
            {reserves.length === 0 ? <p className="text-sm text-muted-ledger">No reserve records yet. Estimates above show the suggested reserve.</p> : null}
          </div>
        </Card>
        <Card>
          <CardHeader><CardTitle>Editable rule assumptions</CardTitle></CardHeader>
          <div className="space-y-2">
            {profiles.map((profile) => {
              const currency: Currency = profile.entity.slug === "uk_ltd" ? "GBP" : "MAD";
              return (
                <div key={profile.id} className="rounded-md bg-surface-inset p-3">
                  <p className="text-sm font-medium">{profile.name}</p>
                  <p className="text-xs text-muted-ledger">{profile.entity.name} · effective {profile.effectiveFrom.toISOString().slice(0, 10)}</p>
                  <div className="mt-2">
                    <TaxRulesPanel rules={profile.rules} currency={currency} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <Card className="mt-4">
        <CardHeader><CardTitle>Deadline calendar</CardTitle></CardHeader>
        <div className="space-y-2">
          {deadlines.map((item) => <div key={item.id} className="rounded-md bg-surface-inset p-3 text-sm">{item.title} · {item.jurisdiction} · {item.dueDate.toISOString().slice(0, 10)}</div>)}
          {deadlines.length === 0 ? <p className="text-sm text-muted-ledger">Add deadlines for Companies House, HMRC, and Morocco declarations as your dates become fixed.</p> : null}
        </div>
      </Card>
    </>
  );
}

type EstimateView = {
  taxableBaseCents: number;
  estimatedTaxCents: number;
  reserveCents: number;
  currency: "MAD" | "GBP" | "USD" | "EUR";
  assumptions: unknown;
};

function EstimateCard({ title, estimate }: { title: string; estimate: EstimateView | null }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      {estimate ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Taxable base" value={formatMoney(estimate.taxableBaseCents, estimate.currency)} />
            <MetricCard label="Tax estimate" value={formatMoney(estimate.estimatedTaxCents, estimate.currency)} tone="risk" />
            <MetricCard label="Reserve" value={formatMoney(estimate.reserveCents, estimate.currency)} tone="deadline" />
          </div>
          <div className="mt-4 rounded-md bg-surface-inset p-3">
            <TaxRulesPanel rules={estimate.assumptions} currency={estimate.currency} title="Assumptions" />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-ledger">Estimate unavailable until the database is reachable.</p>
      )}
    </Card>
  );
}
