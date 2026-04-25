import { PageHeader } from "@/components/app/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ExchangeRatesPanel } from "@/components/app/exchange-rates-panel";
import { prisma } from "@/lib/server/db";
import { rateSummary } from "@/lib/server/rates";

export const dynamic = "force-dynamic";

const PREFERENCE_LABELS: Record<string, string> = {
  defaultCurrency: "Default currency",
  weekStart: "Week starts on",
  locale: "Display locale",
  numberFormat: "Number format",
  dateFormat: "Date format",
  theme: "Theme",
  reportingDefault: "Reporting period",
};

export default async function SettingsPage() {
  const [settings, rates] = await Promise.all([
    prisma.setting.findMany({ orderBy: { key: "asc" } }).catch(() => []),
    rateSummary().catch(() => ({ rates: [], lastUpdated: null })),
  ]);

  const knownPrefs = settings.filter((s) => s.key in PREFERENCE_LABELS);
  const otherPrefs = settings.filter((s) => !(s.key in PREFERENCE_LABELS));

  return (
    <>
      <PageHeader title="Settings" description="Exchange rates, manual overrides, app preferences, AWS status, and PWA install metadata." badge="Control" />
      <section className="grid gap-4 xl:grid-cols-2">
        <ExchangeRatesPanel
          initialRates={rates.rates}
          initialLastUpdated={rates.lastUpdated ? rates.lastUpdated.toISOString() : null}
        />
        <Card>
          <CardHeader><CardTitle>Preferences</CardTitle></CardHeader>
          {knownPrefs.length === 0 && otherPrefs.length === 0 ? (
            <div className="space-y-2 text-sm text-muted-ledger">
              <p>No preferences configured yet. Defaults in effect:</p>
              <ul className="list-inside list-disc space-y-1 text-xs">
                <li>Default currency: <span className="text-foreground">MAD</span></li>
                <li>Display locale: <span className="text-foreground">fr-MA</span> (period thousands, comma decimal)</li>
                <li>Theme: <span className="text-foreground">dark</span></li>
              </ul>
            </div>
          ) : (
            <div className="space-y-2">
              {knownPrefs.map((pref) => (
                <div key={pref.key} className="flex justify-between rounded-md bg-surface-inset p-3 text-sm">
                  <span className="text-muted-ledger">{PREFERENCE_LABELS[pref.key]}</span>
                  <span className="font-medium">{String(pref.value)}</span>
                </div>
              ))}
              {otherPrefs.length > 0 ? (
                <details className="mt-3 rounded-md bg-surface-inset p-3 text-xs text-muted-ledger">
                  <summary className="cursor-pointer">Other settings ({otherPrefs.length})</summary>
                  <ul className="mt-2 space-y-1">
                    {otherPrefs.map((pref) => (
                      <li key={pref.key} className="flex justify-between gap-3">
                        <code>{pref.key}</code>
                        <span className="truncate">{JSON.stringify(pref.value)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          )}
        </Card>
      </section>
    </>
  );
}
