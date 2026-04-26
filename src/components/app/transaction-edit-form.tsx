"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Category, FinancialEntity } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { LedgerTransaction } from "@/components/app/transactions-ledger";

type Props = {
  transaction: LedgerTransaction & { notes?: string | null; counterparty?: string | null };
  categories: Category[];
  entities: FinancialEntity[];
  onClose: () => void;
  onSaved: () => void;
};

// Inline edit form — mirrors the most-likely-edited fields on Quick-add (date,
// kind, amount, currency, category, description, entity). PATCHes the existing
// row by id; the API already supports partial updates.
export function TransactionEditForm({ transaction, categories, entities, onClose, onSaved }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const initialDate = transaction.date.slice(0, 10);
  const initialAmount = (transaction.amountCents / 100).toFixed(2);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const body = {
      date: form.get("date"),
      kind: form.get("kind"),
      context: form.get("context"),
      entityId: form.get("entityId") || null,
      amount: form.get("amount"),
      currency: form.get("currency"),
      categoryId: form.get("categoryId") || null,
      description: form.get("description"),
      counterparty: form.get("counterparty") || null,
      notes: form.get("notes") || null,
    };
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string; issues?: Array<{ path: string; message: string }> };
        const message = json.issues?.length
          ? json.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
          : json.error ?? "Could not update transaction.";
        toast.error(message);
        return;
      }
      toast.success("Transaction updated.");
      onSaved();
    } catch {
      toast.error("Could not update transaction.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
      <div>
        <label htmlFor="edit-tx-date" className="mb-1 block text-xs text-muted-ledger">Date</label>
        <Input id="edit-tx-date" name="date" type="date" defaultValue={initialDate} required />
      </div>
      <div>
        <label htmlFor="edit-tx-kind" className="mb-1 block text-xs text-muted-ledger">Kind</label>
        <Select id="edit-tx-kind" name="kind" defaultValue={transaction.kind}>
          <option value="EXPENSE">Expense</option>
          <option value="INCOME">Income</option>
          <option value="TRANSFER">Transfer</option>
          <option value="ADJUSTMENT">Adjustment</option>
        </Select>
      </div>
      <div>
        <label htmlFor="edit-tx-context" className="mb-1 block text-xs text-muted-ledger">Context</label>
        <Select id="edit-tx-context" name="context" defaultValue={transaction.context}>
          <option value="PERSONAL">Personal</option>
          <option value="BUSINESS">Business</option>
          <option value="BOTH">Shared</option>
        </Select>
      </div>
      <div>
        <label htmlFor="edit-tx-entity" className="mb-1 block text-xs text-muted-ledger">Entity</label>
        <Select id="edit-tx-entity" name="entityId" defaultValue={transaction.entityId ?? ""}>
          <option value="">Unassigned</option>
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>{entity.name}</option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-[1fr_96px] gap-2 md:col-span-2">
        <div>
          <label htmlFor="edit-tx-amount" className="mb-1 block text-xs text-muted-ledger">Amount</label>
          <Input id="edit-tx-amount" name="amount" inputMode="decimal" defaultValue={initialAmount} required />
        </div>
        <div>
          <label htmlFor="edit-tx-currency" className="mb-1 block text-xs text-muted-ledger">Currency</label>
          <Select id="edit-tx-currency" name="currency" defaultValue={transaction.currency}>
            <option>MAD</option>
            <option>GBP</option>
            <option>USD</option>
            <option>EUR</option>
          </Select>
        </div>
      </div>
      <div>
        <label htmlFor="edit-tx-category" className="mb-1 block text-xs text-muted-ledger">Category</label>
        <Select id="edit-tx-category" name="categoryId" defaultValue={transaction.categoryId ?? ""}>
          <option value="">Uncategorized</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </Select>
      </div>
      <div>
        <label htmlFor="edit-tx-counterparty" className="mb-1 block text-xs text-muted-ledger">Counterparty</label>
        <Input id="edit-tx-counterparty" name="counterparty" defaultValue={transaction.counterparty ?? ""} />
      </div>
      <div className="md:col-span-2">
        <label htmlFor="edit-tx-description" className="mb-1 block text-xs text-muted-ledger">Description</label>
        <Input id="edit-tx-description" name="description" defaultValue={transaction.description} required />
      </div>
      <div className="md:col-span-2">
        <label htmlFor="edit-tx-notes" className="mb-1 block text-xs text-muted-ledger">Notes</label>
        <Textarea id="edit-tx-notes" name="notes" defaultValue={transaction.notes ?? ""} />
      </div>
      <div className="flex items-center gap-2 md:col-span-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save changes"}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
