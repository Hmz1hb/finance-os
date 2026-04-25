import { PageHeader } from "@/components/app/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { prisma } from "@/lib/server/db";
import { formatMoney } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

export default async function EmergencyFundPage() {
  const [config, expenses] = await Promise.all([
    prisma.emergencyFundConfig.findFirst().catch(() => null),
    prisma.transaction.aggregate({ where: { context: "PERSONAL", kind: "EXPENSE", deletedAt: null }, _sum: { madEquivalentCents: true }, _count: true }).catch(() => null),
  ]);
  const monthlyAverage = Math.round((expenses?._sum.madEquivalentCents ?? 0) / Math.max(1, new Date().getUTCMonth() + 1));
  const target = monthlyAverage * (config?.targetMonths ?? 6);
  const current = config?.currentBalanceCents ?? 0;
  return (
    <>
      <PageHeader title="Emergency fund" description="Runway target, current coverage, contribution history, and months of expenses covered." badge="Runway" />
      <Card>
        <CardHeader><CardTitle>{((current / Math.max(1, monthlyAverage))).toFixed(1)} months covered</CardTitle></CardHeader>
        <Progress value={(current / Math.max(1, target)) * 100} />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <p className="rounded-md bg-surface-inset p-3 text-sm">Current<br /><span className="font-semibold">{formatMoney(current)}</span></p>
          <p className="rounded-md bg-surface-inset p-3 text-sm">Target<br /><span className="font-semibold">{formatMoney(target)}</span></p>
          <p className="rounded-md bg-surface-inset p-3 text-sm">Monthly avg<br /><span className="font-semibold">{formatMoney(monthlyAverage)}</span></p>
        </div>
      </Card>
    </>
  );
}
