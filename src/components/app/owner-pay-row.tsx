"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Currency, FinancialEntity, OwnerCompensation, OwnerCompensationType } from "@prisma/client";
import { RowActions } from "@/components/app/row-actions";
import { EditDialog } from "@/components/app/edit-dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { formatMad } from "@/lib/finance/money";

type PaymentWithEntities = OwnerCompensation & {
  fromEntity: FinancialEntity;
  toEntity: FinancialEntity;
};

type Props = {
  payment: PaymentWithEntities;
};

export function OwnerPayRow({ payment }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-md bg-surface-inset p-3">
      <div className="flex justify-between gap-3">
        <p className="text-sm font-medium">{payment.paymentType}</p>
        <div className="flex items-start gap-2">
          <p className="text-sm font-semibold">{formatMad(payment.madEquivalentCents)}</p>
          <RowActions id={payment.id} resource="owner-pay" onEdit={() => setEditing(true)} />
        </div>
      </div>
      <p className="text-xs text-muted-ledger">
        {payment.fromEntity.name} to {payment.toEntity.name} · {payment.date.toISOString().slice(0, 10)}
      </p>
      {payment.taxTreatment ? <p className="mt-2 text-xs text-muted-ledger">{payment.taxTreatment}</p> : null}
      <EditDialog open={editing} onClose={() => setEditing(false)} title="Edit owner pay">
        <OwnerPayEditForm
          payment={payment}
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

function OwnerPayEditForm({
  payment,
  onClose,
  onSaved,
}: {
  payment: PaymentWithEntities;
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
      date: form.get("date"),
      amount: form.get("amount"),
      currency: form.get("currency") as Currency,
      paymentType: form.get("paymentType") as OwnerCompensationType,
      taxTreatment: form.get("taxTreatment") || null,
      notes: form.get("notes") || null,
    };
    try {
      const response = await fetch(`/api/owner-pay/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string; issues?: Array<{ path: string; message: string }> };
        const message = json.issues?.length
          ? json.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
          : json.error ?? "Could not update owner pay.";
        toast.error(message);
        return;
      }
      toast.success("Owner pay updated.");
      onSaved();
    } catch {
      toast.error("Could not update owner pay.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
      <div>
        <label htmlFor="edit-ownerpay-date" className="mb-1 block text-xs text-muted-ledger">Date</label>
        <Input
          id="edit-ownerpay-date"
          name="date"
          type="date"
          defaultValue={payment.date.toISOString().slice(0, 10)}
          required
        />
      </div>
      <div>
        <label htmlFor="edit-ownerpay-payment-type" className="mb-1 block text-xs text-muted-ledger">Payment type</label>
        <Select id="edit-ownerpay-payment-type" name="paymentType" defaultValue={payment.paymentType}>
          <option value="SALARY">Salary</option>
          <option value="DIVIDEND">Dividend</option>
          <option value="DIRECTOR_LOAN">Director loan</option>
          <option value="REIMBURSEMENT">Reimbursement</option>
          <option value="DRAWINGS">Drawings</option>
          <option value="OTHER">Other</option>
        </Select>
      </div>
      <div>
        <label htmlFor="edit-ownerpay-amount" className="mb-1 block text-xs text-muted-ledger">Amount</label>
        <Input
          id="edit-ownerpay-amount"
          name="amount"
          inputMode="decimal"
          defaultValue={(payment.amountCents / 100).toFixed(2)}
          required
        />
      </div>
      <div>
        <label htmlFor="edit-ownerpay-currency" className="mb-1 block text-xs text-muted-ledger">Currency</label>
        <Select id="edit-ownerpay-currency" name="currency" defaultValue={payment.currency}>
          <option>GBP</option>
          <option>MAD</option>
          <option>USD</option>
          <option>EUR</option>
        </Select>
      </div>
      <div className="md:col-span-2">
        <label htmlFor="edit-ownerpay-tax" className="mb-1 block text-xs text-muted-ledger">Tax treatment</label>
        <Input id="edit-ownerpay-tax" name="taxTreatment" defaultValue={payment.taxTreatment ?? ""} />
      </div>
      <div className="md:col-span-2">
        <label htmlFor="edit-ownerpay-notes" className="mb-1 block text-xs text-muted-ledger">Notes</label>
        <Textarea id="edit-ownerpay-notes" name="notes" defaultValue={payment.notes ?? ""} />
      </div>
      <div className="flex items-center gap-2 md:col-span-2">
        <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save changes"}</Button>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
