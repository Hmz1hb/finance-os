import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/server/db";
import { rateSummary } from "@/lib/server/rates";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, rates] = await Promise.all([
    prisma.setting.findMany({ orderBy: { key: "asc" } }).catch(() => []),
    rateSummary().catch(() => ({ rates: [], lastUpdated: null })),
  ]);
  return (
    <>
      <PageHeader title="Settings" description="Exchange rates, manual overrides, app preferences, AWS status, and PWA install metadata." badge="Control" />
      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Exchange rates</CardTitle></CardHeader>
          <p className="mb-4 text-sm text-muted-ledger">Rates last updated: {rates.lastUpdated ? rates.lastUpdated.toISOString() : "never"}</p>
          <form action="/api/exchange-rates" method="post">
            <input type="hidden" name="action" value="refresh" />
            <Button type="submit" variant="outline"><RefreshCw className="h-4 w-4" /> Refresh via API</Button>
          </form>
          <div className="mt-4 space-y-2">
            {rates.rates.map((rate) => <div key={rate.pair} className="flex justify-between rounded-md bg-surface-inset p-3 text-sm"><span>{rate.pair}</span><span>{rate.rate.toFixed(4)} {rate.isManual ? "manual" : rate.source}</span></div>)}
          </div>
        </Card>
        <Card>
          <CardHeader><CardTitle>Preferences</CardTitle></CardHeader>
          <pre className="overflow-auto rounded-md bg-surface-inset p-3 text-xs text-muted-ledger">{JSON.stringify(settings, null, 2)}</pre>
        </Card>
      </section>
    </>
  );
}
