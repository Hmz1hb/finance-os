"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { differenceInCalendarDays } from "date-fns";
import { toast } from "sonner";
import type { FinancialEntity, Receivable, ReceivablePayment } from "@prisma/client";
import { ReceivablePaymentForm } from "@/components/app/receivable-payment-form";
import { RowActions } from "@/components/app/row-actions";
import { EditDialog } from "@/components/app/edit-dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { formatMoney } from "@/lib/finance/money";

type ReceivableWithRelations = Receivable & {
  entity: FinancialEntity;
  payments: ReceivablePayment[];
};

type Props = {
  receivable: ReceivableWithRelations;
  status: string;
  entities: FinancialEntity[];
};

export function ReceivableRow({ receivable, status, entities }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const remaining = Math.max(0, receivable.amountCents - receivable.paidAmountCents);

  return (
    <div className="rounded-md bg-surface-inset p-3">
      <div className="flex justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{receivable.title}</p>
          <p className="text-xs text-muted-ledger">
            {receivable.entity.name} · {receivable.counterparty} · {status}
            {receivable.dueDate ? ` · ${Math.max(0, differenceInCalendarDays(new Date(), receivable.dueDate))} days aged` : ""}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <p className="text-sm font-semibold">{formatMoney(remaining, receivable.currency)}</p>
          <RowActions id={receivable.id} resource="receivables" onEdit={() => setEditing(true)} />
        </div>
      </div>
      {!["PAID", "CANCELLED"].includes(status) ? <ReceivablePaymentForm receivableId={receivable.id} /> : null}
      <EditDialog open={editing} onClose={() => setEditing(false)} title="Edit receivable">
        <ReceivableEditForm
          receivable={receivable}
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

function ReceivableEditForm({
  receivable,
  entities,
  onClose,
  onSaved,
}: {
  receivable: ReceivableWithRelations;
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
      kind: form.get("kind"),
      counterparty: form.get("counterparty"),
      title: form.get("title"),
      issueDate: form.get("issueDate"),
      dueDate: form.get("dueDate") || null,
      amount: form.get("amount"),
      currency: form.get("currency"),
      status: form.get("status"),
      notes: form.get("notes") || null,
    };
    try {
      const response = await fetch(`/api/receivables/${receivable.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string; issues?: Array<{ path: string; message: string }> };
        const message = json.issues?.length
          ? json.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
          : json.error ?? "Could not update receivable.";
        toast.error(message);
        return;
      }
      toast.success("Receivable updated.");
      onSaved();
    } catch {
      toast.error("Could not update receivable.");
    } finally {
      setSubmitting(false);
    }
  }

  // entities is accepted for API symmetry with the other row components but the
  // PATCH schema doesn't change entity assignment from this form (deliberate —
  // re-assigning a receivable to a different entity has tax/FX implications).
  void entities;

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <label htmlFor="edit-rec-title" className="mb-1 block text-xs text-muted-ledger">Title</label>
        <Input id="edit-rec-title" name="title" defaultValue={receivable.title} required />
      </div>
      <div>
        <label htmlFor="edit-rec-counterparty" className="mb-1 block text-xs text-muted-ledger">Counterparty</label>
        <Input id="edit-rec-counterparty" name="counterparty" defaultValue={receivable.counterparty} required />
      </div>
      <div>
        <label htmlFor="edit-rec-kind" className="mb-1 block text-xs text-muted-ledger">Kind</label>
        <Select id="edit-rec-kind" name="kind" defaultValue={receivable.kind}>
          <option value="INVOICE">Invoice</option>
          <option value="IOU">IOU</option>
          <option value="LOAN">Loan</option>
          <option value="REFUND">Refund</option>
          <option value="OTHER">Other</option>
        </Select>
      </div>
      <div>
        <label htmlFor="edit-rec-issue" className="mb-1 block text-xs text-muted-ledger">Issue date</label>
        <Input
          id="edit-rec-issue"
          name="issueDate"
          type="date"
          defaultValue={receivable.issueDate.toISOString().slice(0, 10)}
        />
      </div>
      <div>
        <label htmlFor="edit-rec-due" className="mb-1 block text-xs text-muted-ledger">Due date</label>
        <Input
          id="edit-rec-due"
          name="dueDate"
          type="date"
          defaultValue={receivable.dueDate ? receivable.dueDate.toISOString().slice(0, 10) : ""}
        />
      </div>
      <div>
        <label htmlFor="edit-rec-amount" className="mb-1 block text-xs text-muted-ledger">Amount</label>
        <Input
          id="edit-rec-amount"
          name="amount"
          inputMode="decimal"
          defaultValue={(receivable.amountCents / 100).toFixed(2)}
          required
        />
      </div>
      <div>
        <label htmlFor="edit-rec-currency" className="mb-1 block text-xs text-muted-ledger">Currency</label>
        <Select id="edit-rec-currency" name="currency" defaultValue={receivable.currency}>
          <option>MAD</option>
          <option>GBP</option>
          <option>USD</option>
          <option>EUR</option>
        </Select>
      </div>
      <div>
        <label htmlFor="edit-rec-status" className="mb-1 block text-xs text-muted-ledger">Status</label>
        <Select id="edit-rec-status" name="status" defaultValue={receivable.status}>
          <option value="OPEN">Open</option>
          <option value="PARTIAL">Partial</option>
          <option value="OVERDUE">Overdue</option>
          <option value="DISPUTED">Disputed</option>
          <option value="PAID">Paid</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </div>
      <div className="md:col-span-2">
        <label htmlFor="edit-rec-notes" className="mb-1 block text-xs text-muted-ledger">Notes</label>
        <Textarea id="edit-rec-notes" name="notes" defaultValue={receivable.notes ?? ""} />
      </div>
      <div className="flex items-center gap-2 md:col-span-2">
        <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save changes"}</Button>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
