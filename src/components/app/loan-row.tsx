"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Currency, FinancialEntity, Loan, LoanKind, LoanPayment } from "@prisma/client";
import { RowActions } from "@/components/app/row-actions";
import { EditDialog } from "@/components/app/edit-dialog";
import { LoanPaymentForm } from "@/components/app/loan-payment-form";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { formatMoney } from "@/lib/finance/money";

type LoanWithRelations = Loan & { entity: FinancialEntity | null; payments: LoanPayment[] };

type Props = {
  loan: LoanWithRelations;
  entities: FinancialEntity[];
};

// Wraps a single loan row in client state so RowActions.onEdit can open an
// EditDialog with a pre-populated form that PATCHes /api/loans/[id].
export function LoanRow({ loan, entities }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-md bg-surface-inset p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{loan.lenderName}</p>
          <p className="text-xs text-muted-ledger">
            {loan.entity?.name ?? "Unassigned"} · {loan.kind} · {Number(loan.interestRate)}% · monthly {formatMoney(loan.monthlyPaymentCents, loan.currency)}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <p className="text-sm font-semibold">{formatMoney(loan.remainingBalanceCents, loan.currency)}</p>
          <RowActions id={loan.id} resource="loans" onEdit={() => setEditing(true)} />
        </div>
      </div>
      <LoanPaymentForm loanId={loan.id} />
      <EditDialog open={editing} onClose={() => setEditing(false)} title="Edit loan">
        <LoanEditForm
          loan={loan}
          entities={entities}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      </EditDialog>
    </div>
  );
}

function LoanEditForm({
  loan,
  entities,
  onClose,
  onSaved,
}: {
  loan: LoanWithRelations;
  entities: FinancialEntity[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const body = {
      kind: form.get("kind") as LoanKind,
      lenderName: form.get("lenderName"),
      currency: form.get("currency") as Currency,
      interestRate: form.get("interestRate"),
      monthlyPayment: form.get("monthlyPayment"),
      remainingBalance: form.get("remainingBalance"),
      entityId: form.get("entityId") || null,
      notes: form.get("notes") || null,
    };
    try {
      const response = await fetch(`/api/loans/${loan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string; issues?: Array<{ path: string; message: string }> };
        const message = json.issues?.length
          ? json.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
          : json.error ?? "Could not update loan.";
        toast.error(message);
        return;
      }
      toast.success("Loan updated.");
      onSaved();
    } catch {
      toast.error("Could not update loan.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
      <div>
        <label htmlFor="edit-loan-lender" className="mb-1 block text-xs text-muted-ledger">Lender / creditor</label>
        <Input id="edit-loan-lender" name="lenderName" defaultValue={loan.lenderName} required />
      </div>
      <div>
        <label htmlFor="edit-loan-kind" className="mb-1 block text-xs text-muted-ledger">Kind</label>
        <Select id="edit-loan-kind" name="kind" defaultValue={loan.kind}>
          <option value="OWED_BY_ME">Owed by me</option>
          <option value="CREDIT_CARD">Credit card</option>
          <option value="BUSINESS_LOAN">Business loan</option>
          <option value="BNPL">BNPL</option>
        </Select>
      </div>
      <div>
        <label htmlFor="edit-loan-entity" className="mb-1 block text-xs text-muted-ledger">Entity</label>
        <Select id="edit-loan-entity" name="entityId" defaultValue={loan.entityId ?? ""}>
          <option value="">Unassigned</option>
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>{entity.name}</option>
          ))}
        </Select>
      </div>
      <div>
        <label htmlFor="edit-loan-currency" className="mb-1 block text-xs text-muted-ledger">Currency</label>
        <Select id="edit-loan-currency" name="currency" defaultValue={loan.currency}>
          <option>MAD</option>
          <option>GBP</option>
          <option>USD</option>
          <option>EUR</option>
        </Select>
      </div>
      <div>
        <label htmlFor="edit-loan-remaining" className="mb-1 block text-xs text-muted-ledger">Remaining balance</label>
        <Input
          id="edit-loan-remaining"
          name="remainingBalance"
          inputMode="decimal"
          defaultValue={(loan.remainingBalanceCents / 100).toFixed(2)}
          required
        />
      </div>
      <div>
        <label htmlFor="edit-loan-monthly" className="mb-1 block text-xs text-muted-ledger">Monthly payment</label>
        <Input
          id="edit-loan-monthly"
          name="monthlyPayment"
          inputMode="decimal"
          defaultValue={(loan.monthlyPaymentCents / 100).toFixed(2)}
          required
        />
      </div>
      <div>
        <label htmlFor="edit-loan-rate" className="mb-1 block text-xs text-muted-ledger">Interest rate %</label>
        <Input
          id="edit-loan-rate"
          name="interestRate"
          inputMode="decimal"
          defaultValue={String(Number(loan.interestRate))}
        />
      </div>
      <div className="md:col-span-2">
        <label htmlFor="edit-loan-notes" className="mb-1 block text-xs text-muted-ledger">Notes</label>
        <Textarea id="edit-loan-notes" name="notes" defaultValue={loan.notes ?? ""} />
      </div>
      <div className="flex items-center gap-2 md:col-span-2">
        <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save changes"}</Button>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
