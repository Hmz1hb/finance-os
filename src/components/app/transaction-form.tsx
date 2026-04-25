"use client";

import { useRouter } from "next/navigation";
import type { Category, FinancialEntity } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useFormSubmit } from "@/lib/client/use-form-submit";

export function TransactionForm({ categories, entities }: { categories: Category[]; entities: FinancialEntity[] }) {
  const router = useRouter();
  const { onSubmit, submitting } = useFormSubmit({
    url: "/api/transactions",
    method: "POST",
    successMessage: "Transaction saved.",
    errorMessage: "Could not save transaction.",
    onSuccess: () => router.refresh(),
    buildBody: (form) => ({
      date: form.get("date"),
      kind: form.get("kind"),
      context: form.get("context"),
      entityId: form.get("entityId"),
      amount: form.get("amount"),
      currency: form.get("currency"),
      categoryId: form.get("categoryId") || undefined,
      description: form.get("description"),
      counterparty: form.get("counterparty"),
      paymentMethod: form.get("paymentMethod"),
      notes: form.get("notes"),
      taxDeductible: form.get("taxDeductible") === "on",
    }),
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
      <div>
        <label htmlFor="tx-date" className="mb-1 block text-xs text-muted-ledger">
          Date
        </label>
        <Input
          id="tx-date"
          name="date"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
        />
      </div>
      <div>
        <label htmlFor="tx-kind" className="mb-1 block text-xs text-muted-ledger">
          Kind
        </label>
        <Select id="tx-kind" name="kind" defaultValue="EXPENSE">
          <option value="EXPENSE">Expense</option>
          <option value="INCOME">Income</option>
          <option value="TRANSFER">Transfer</option>
          <option value="ADJUSTMENT">Adjustment</option>
        </Select>
      </div>
      <div>
        <label htmlFor="tx-context" className="mb-1 block text-xs text-muted-ledger">
          Context
        </label>
        <Select id="tx-context" name="context" defaultValue="PERSONAL">
          <option value="PERSONAL">Personal</option>
          <option value="BUSINESS">Business</option>
          <option value="BOTH">Shared</option>
        </Select>
      </div>
      <div>
        <label htmlFor="tx-entity" className="mb-1 block text-xs text-muted-ledger">
          Entity
        </label>
        <Select
          id="tx-entity"
          name="entityId"
          defaultValue={entities.find((entity) => entity.id === "morocco_personal")?.id ?? entities[0]?.id}
        >
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <div>
          <label htmlFor="tx-amount" className="mb-1 block text-xs text-muted-ledger">
            Amount
          </label>
          <Input id="tx-amount" name="amount" inputMode="decimal" placeholder="Amount" required />
        </div>
        <div>
          <label htmlFor="tx-currency" className="mb-1 block text-xs text-muted-ledger">
            Currency
          </label>
          <Select id="tx-currency" name="currency" defaultValue="MAD">
            <option>MAD</option>
            <option>GBP</option>
            <option>USD</option>
            <option>EUR</option>
          </Select>
        </div>
      </div>
      <div>
        <label htmlFor="tx-category" className="mb-1 block text-xs text-muted-ledger">
          Category
        </label>
        <Select id="tx-category" name="categoryId" defaultValue="">
          <option value="">Uncategorized</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label htmlFor="tx-counterparty" className="mb-1 block text-xs text-muted-ledger">
          Counterparty
        </label>
        <Input id="tx-counterparty" name="counterparty" placeholder="Vendor, client, lender..." />
      </div>
      <div className="md:col-span-2">
        <label htmlFor="tx-description" className="mb-1 block text-xs text-muted-ledger">
          Description
        </label>
        <Input id="tx-description" name="description" placeholder="Description" required />
      </div>
      <div>
        <label htmlFor="tx-payment-method" className="mb-1 block text-xs text-muted-ledger">
          Payment method
        </label>
        <Input id="tx-payment-method" name="paymentMethod" placeholder="Cash, card, PayPal, Stripe..." />
      </div>
      <label className="flex h-10 items-center gap-2 rounded-md border border-ledger-border bg-surface-inset px-3 text-sm text-muted-ledger">
        <input name="taxDeductible" type="checkbox" className="accent-blue-ledger" />
        Tax deductible
      </label>
      <div className="md:col-span-2">
        <label htmlFor="tx-notes" className="mb-1 block text-xs text-muted-ledger">
          Notes
        </label>
        <Textarea id="tx-notes" name="notes" placeholder="Notes" />
      </div>
      <Button type="submit" disabled={submitting} className="md:col-span-2">
        {submitting ? "Saving..." : "Save transaction"}
      </Button>
    </form>
  );
}
