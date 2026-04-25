"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useFormSubmit } from "@/lib/client/use-form-submit";

export function OwnerCompensationForm() {
  const router = useRouter();
  const { onSubmit, submitting } = useFormSubmit({
    url: "/api/owner-pay",
    method: "POST",
    successMessage: "Owner compensation recorded with linked transactions.",
    errorMessage: "Could not record owner pay.",
    onSuccess: () => router.refresh(),
    buildBody: (form) => Object.fromEntries(form),
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
      <div>
        <label htmlFor="ownerpay-date" className="mb-1 block text-xs text-muted-ledger">
          Date
        </label>
        <Input
          id="ownerpay-date"
          name="date"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
        />
      </div>
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <div>
          <label htmlFor="ownerpay-amount" className="mb-1 block text-xs text-muted-ledger">
            Amount
          </label>
          <Input id="ownerpay-amount" name="amount" inputMode="decimal" placeholder="Amount" required />
        </div>
        <div>
          <label htmlFor="ownerpay-currency" className="mb-1 block text-xs text-muted-ledger">
            Currency
          </label>
          <Select id="ownerpay-currency" name="currency" defaultValue="GBP">
            <option>GBP</option>
            <option>MAD</option>
            <option>USD</option>
            <option>EUR</option>
          </Select>
        </div>
      </div>
      <div>
        <label htmlFor="ownerpay-payment-type" className="mb-1 block text-xs text-muted-ledger">
          Payment type
        </label>
        <Select id="ownerpay-payment-type" name="paymentType" defaultValue="DIVIDEND">
          <option value="SALARY">Salary</option>
          <option value="DIVIDEND">Dividend</option>
          <option value="DIRECTOR_LOAN">Director loan</option>
          <option value="REIMBURSEMENT">Reimbursement</option>
          <option value="DRAWINGS">Drawings</option>
          <option value="OTHER">Other</option>
        </Select>
      </div>
      <div>
        <label htmlFor="ownerpay-tax" className="mb-1 block text-xs text-muted-ledger">
          Tax treatment override
        </label>
        <Input id="ownerpay-tax" name="taxTreatment" placeholder="Tax treatment override" />
      </div>
      <div className="md:col-span-2">
        <label htmlFor="ownerpay-notes" className="mb-1 block text-xs text-muted-ledger">
          Notes
        </label>
        <Textarea id="ownerpay-notes" name="notes" placeholder="Notes" />
      </div>
      <Button type="submit" disabled={submitting} className="md:col-span-2">
        {submitting ? "Saving..." : "Record owner pay"}
      </Button>
    </form>
  );
}
