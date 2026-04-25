"use client";

import { useRouter } from "next/navigation";
import type { FinancialEntity } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useFormSubmit } from "@/lib/client/use-form-submit";

export function LoanForm({ entities }: { entities: FinancialEntity[] }) {
  const router = useRouter();
  const { onSubmit, submitting } = useFormSubmit({
    url: "/api/loans",
    method: "POST",
    successMessage: "Loan added.",
    errorMessage: "Could not add loan.",
    onSuccess: () => router.refresh(),
    buildBody: (form) => Object.fromEntries(form),
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
      <div>
        <label htmlFor="loan-lender" className="mb-1 block text-xs text-muted-ledger">
          Lender / creditor
        </label>
        <Input id="loan-lender" name="lenderName" placeholder="Lender / creditor" required />
      </div>
      <div>
        <label htmlFor="loan-kind" className="mb-1 block text-xs text-muted-ledger">
          Kind
        </label>
        <Select id="loan-kind" name="kind" defaultValue="OWED_BY_ME">
          <option value="OWED_BY_ME">Owed by me</option>
          <option value="CREDIT_CARD">Credit card</option>
          <option value="BUSINESS_LOAN">Business loan</option>
          <option value="BNPL">BNPL</option>
        </Select>
      </div>
      <div>
        <label htmlFor="loan-entity" className="mb-1 block text-xs text-muted-ledger">
          Entity
        </label>
        <Select id="loan-entity" name="entityId" defaultValue={entities[0]?.id}>
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label htmlFor="loan-currency" className="mb-1 block text-xs text-muted-ledger">
          Currency
        </label>
        <Select id="loan-currency" name="currency" defaultValue="MAD">
          <option>MAD</option>
          <option>GBP</option>
          <option>USD</option>
          <option>EUR</option>
        </Select>
      </div>
      <div>
        <label htmlFor="loan-original" className="mb-1 block text-xs text-muted-ledger">
          Original amount
        </label>
        <Input id="loan-original" name="originalAmount" inputMode="decimal" placeholder="Original amount" required />
      </div>
      <div>
        <label htmlFor="loan-remaining" className="mb-1 block text-xs text-muted-ledger">
          Remaining balance
        </label>
        <Input
          id="loan-remaining"
          name="remainingBalance"
          inputMode="decimal"
          placeholder="Remaining balance"
          required
        />
      </div>
      <div>
        <label htmlFor="loan-monthly" className="mb-1 block text-xs text-muted-ledger">
          Monthly payment
        </label>
        <Input id="loan-monthly" name="monthlyPayment" inputMode="decimal" placeholder="Monthly payment" required />
      </div>
      <div>
        <label htmlFor="loan-rate" className="mb-1 block text-xs text-muted-ledger">
          Interest rate %
        </label>
        <Input id="loan-rate" name="interestRate" inputMode="decimal" placeholder="0" defaultValue="0" />
      </div>
      <div>
        <label htmlFor="loan-start" className="mb-1 block text-xs text-muted-ledger">
          Start date
        </label>
        <Input
          id="loan-start"
          name="startDate"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
        />
      </div>
      <div>
        <label htmlFor="loan-payoff" className="mb-1 block text-xs text-muted-ledger">
          Expected payoff
        </label>
        <Input id="loan-payoff" name="expectedPayoffDate" type="date" />
      </div>
      <div className="md:col-span-2">
        <label htmlFor="loan-notes" className="mb-1 block text-xs text-muted-ledger">
          Notes
        </label>
        <Textarea id="loan-notes" name="notes" placeholder="Notes" />
      </div>
      <Button type="submit" disabled={submitting} className="md:col-span-2">
        {submitting ? "Saving..." : "Add loan"}
      </Button>
    </form>
  );
}
