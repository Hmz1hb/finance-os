import { PageHeader } from "@/components/app/page-header";
import { PayMyselfForm } from "@/components/app/pay-myself-form";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";
import { formatMoney } from "@/lib/finance/money";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  const [people, payments] = await Promise.all([
    prisma.payrollPerson.findMany({ where: { deletedAt: null }, include: { payments: true }, orderBy: { name: "asc" } }).catch(() => []),
    prisma.payrollPayment.findMany({ include: { person: true }, orderBy: { date: "desc" }, take: 30 }).catch(() => []),
  ]);
  const selfYtd = payments.filter((payment) => payment.person.isSelf).reduce((sum, payment) => sum + payment.madEquivalentCents, 0);
  return (
    <>
      <PageHeader title="Payroll & contractors" description="Track contractors, regular payments, summaries, and the linked Pay Myself flow." badge="People" />
      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>Pay myself</CardTitle></CardHeader>
          <p className="mb-4 text-sm text-muted-ledger">YTD paid to self: {formatMoney(selfYtd)}</p>
          <PayMyselfForm />
        </Card>
        <Card>
          <CardHeader><CardTitle>Payment history</CardTitle></CardHeader>
          <div className="space-y-2">
            {payments.map((payment) => (
              <div key={payment.id} className="flex justify-between rounded-md bg-surface-inset p-3">
                <div><p className="text-sm font-medium">{payment.person.name}</p><p className="text-xs text-muted-ledger">{payment.paymentType} · {payment.date.toISOString().slice(0, 10)}</p></div>
                <p className="text-sm font-semibold">{formatMoney(payment.madEquivalentCents)}</p>
              </div>
            ))}
            {payments.length === 0 ? <p className="text-sm text-muted-ledger">No payroll payments yet.</p> : null}
          </div>
        </Card>
      </section>
      <Card className="mt-4">
        <CardHeader><CardTitle>People</CardTitle></CardHeader>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {people.map((person) => <div key={person.id} className="rounded-md bg-surface-inset p-3"><p className="text-sm font-medium">{person.name}</p><p className="text-xs text-muted-ledger">{person.role} · {person.paymentFrequency}</p></div>)}
        </div>
      </Card>
    </>
  );
}
