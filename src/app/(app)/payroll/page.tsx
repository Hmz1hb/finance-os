import { OwnerCompensationForm } from "@/components/app/owner-compensation-form";
import { OwnerPayRow } from "@/components/app/owner-pay-row";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { formatMad } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  const payments = await prisma.ownerCompensation.findMany({
    include: { fromEntity: true, toEntity: true },
    orderBy: { date: "desc" },
    take: 50,
  }).catch(() => []);
  const ytd = payments
    .filter((payment) => payment.date.getUTCFullYear() === new Date().getUTCFullYear())
    .reduce((sum, payment) => sum + payment.madEquivalentCents, 0);
  const dividends = payments.filter((payment) => payment.paymentType === "DIVIDEND").reduce((sum, payment) => sum + payment.madEquivalentCents, 0);

  return (
    <>
      <PageHeader title="Owner pay" description="Payroll-like owner compensation from UK LTD to personal money with linked ledger entries and tax classification." badge="Owner compensation" />
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Owner pay YTD" value={formatMad(ytd)} tone="income" />
        <MetricCard label="Dividends tracked" value={formatMad(dividends)} tone="plan" />
        <MetricCard label="Records" value={`${payments.length}`} />
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>Record owner pay</CardTitle></CardHeader>
          <OwnerCompensationForm />
        </Card>
        <Card>
          <CardHeader><CardTitle>Compensation history</CardTitle></CardHeader>
          <div className="space-y-2">
            {payments.map((payment) => (
              <OwnerPayRow key={payment.id} payment={payment} />
            ))}
            {payments.length === 0 ? <p className="text-sm text-muted-ledger">No owner compensation recorded yet.</p> : null}
          </div>
        </Card>
      </section>
    </>
  );
}
