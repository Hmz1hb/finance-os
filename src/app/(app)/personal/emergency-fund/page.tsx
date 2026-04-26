import { PageHeader } from "@/components/app/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { prisma } from "@/lib/server/db";
import { formatMad } from "@/lib/finance/money";
import { emergencyFundProjection } from "@/lib/server/health";

export const dynamic = "force-dynamic";

export default async function EmergencyFundPage() {
  const config = await prisma.emergencyFundConfig.findFirst().catch(() => null);
  const projection = await emergencyFundProjection({
    entityId: "morocco_personal",
    targetMonths: config?.targetMonths ?? 6,
  }).catch(() => null);
  const current = config?.currentBalanceCents ?? 0;

  if (!projection || projection.status === "insufficient_history") {
    const months = projection?.monthsOfHistory ?? 0;
    const required = projection?.requiredMonths ?? 3;
    return (
      <>
        <PageHeader title="Emergency fund" description="Runway target, current coverage, contribution history, and months of expenses covered." badge="Runway" />
        <Card>
          <CardHeader><CardTitle>Insufficient history</CardTitle></CardHeader>
          <div className="space-y-3 px-6 pb-6 text-sm text-muted-foreground">
            <p>
              We need at least {required} distinct months of personal expense data to compute a meaningful runway target.
              You currently have {months} {months === 1 ? "month" : "months"} of history.
            </p>
            <p>Keep logging expenses — the auto-target will appear once enough history accumulates.</p>
            {current > 0 ? (
              <p className="rounded-md bg-surface-inset p-3">
                Current balance: <span className="font-semibold">{formatMad(current)}</span>
              </p>
            ) : null}
          </div>
        </Card>
      </>
    );
  }

  const monthlyAverage = projection.monthlyAverageCents;
  const target = projection.targetCents;
  return (
    <>
      <PageHeader title="Emergency fund" description="Runway target, current coverage, contribution history, and months of expenses covered." badge="Runway" />
      <Card>
        <CardHeader><CardTitle>{((current / Math.max(1, monthlyAverage))).toFixed(1)} months covered</CardTitle></CardHeader>
        <Progress value={(current / Math.max(1, target)) * 100} />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <p className="rounded-md bg-surface-inset p-3 text-sm">Current<br /><span className="font-semibold">{formatMad(current)}</span></p>
          <p className="rounded-md bg-surface-inset p-3 text-sm">Target<br /><span className="font-semibold">{formatMad(target)}</span></p>
          <p className="rounded-md bg-surface-inset p-3 text-sm">Monthly avg<br /><span className="font-semibold">{formatMad(monthlyAverage)}</span></p>
        </div>
      </Card>
    </>
  );
}
