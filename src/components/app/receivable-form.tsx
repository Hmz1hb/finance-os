"use client";

import { useRouter } from "next/navigation";
import type { FinancialEntity } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useFormSubmit } from "@/lib/client/use-form-submit";

export function ReceivableForm({ entities }: { entities: FinancialEntity[] }) {
  const router = useRouter();
  const { onSubmit, submitting } = useFormSubmit({
    url: "/api/receivables",
    method: "POST",
    successMessage: "Receivable created.",
    errorMessage: "Could not create receivable.",
    onSuccess: () => router.refresh(),
    buildBody: (form) => Object.fromEntries(form),
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
      <div>
        <label htmlFor="rec-title" className="mb-1 block text-xs text-muted-ledger">
          Title
        </label>
        <Input id="rec-title" name="title" placeholder="What are they paying for?" required />
      </div>
      <div>
        <label htmlFor="rec-counterparty" className="mb-1 block text-xs text-muted-ledger">
          Counterparty
        </label>
        <Input id="rec-counterparty" name="counterparty" placeholder="Who owes you?" required />
      </div>
      <div>
        <label htmlFor="rec-entity" className="mb-1 block text-xs text-muted-ledger">
          Entity
        </label>
        <Select id="rec-entity" name="entityId" defaultValue={entities[0]?.id}>
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label htmlFor="rec-kind" className="mb-1 block text-xs text-muted-ledger">
          Kind
        </label>
        <Select id="rec-kind" name="kind" defaultValue="CLIENT_INVOICE">
          <option value="CLIENT_INVOICE">Client invoice</option>
          <option value="PERSONAL_IOU">Personal IOU</option>
          <option value="BUSINESS_RECEIVABLE">Business receivable</option>
          <option value="OTHER">Other</option>
        </Select>
      </div>
      <div>
        <label htmlFor="rec-issue-date" className="mb-1 block text-xs text-muted-ledger">
          Issue date
        </label>
        <Input
          id="rec-issue-date"
          name="issueDate"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
        />
      </div>
      <div>
        <label htmlFor="rec-due-date" className="mb-1 block text-xs text-muted-ledger">
          Due date
        </label>
        <Input id="rec-due-date" name="dueDate" type="date" />
      </div>
      <div className="grid grid-cols-[1fr_96px] gap-2 md:col-span-2">
        <div>
          <label htmlFor="rec-amount" className="mb-1 block text-xs text-muted-ledger">
            Amount
          </label>
          <Input id="rec-amount" name="amount" inputMode="decimal" placeholder="Amount" required />
        </div>
        <div>
          <label htmlFor="rec-currency" className="mb-1 block text-xs text-muted-ledger">
            Currency
          </label>
          <Select id="rec-currency" name="currency" defaultValue="MAD">
            <option>MAD</option>
            <option>GBP</option>
            <option>USD</option>
            <option>EUR</option>
          </Select>
        </div>
      </div>
      <div className="md:col-span-2">
        <label htmlFor="rec-source" className="mb-1 block text-xs text-muted-ledger">
          Invoice number / source
        </label>
        <Input id="rec-source" name="source" placeholder="Invoice number / source" />
      </div>
      <div className="md:col-span-2">
        <label htmlFor="rec-notes" className="mb-1 block text-xs text-muted-ledger">
          Notes
        </label>
        <Textarea id="rec-notes" name="notes" placeholder="Notes" />
      </div>
      <Button type="submit" disabled={submitting} className="md:col-span-2">
        {submitting ? "Saving..." : "Add receivable"}
      </Button>
    </form>
  );
}
