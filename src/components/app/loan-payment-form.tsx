"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormSubmit } from "@/lib/client/use-form-submit";

export function LoanPaymentForm({ loanId }: { loanId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { onSubmit, submitting } = useFormSubmit({
    url: `/api/loans/${loanId}/payments`,
    method: "POST",
    successMessage: "Payment recorded.",
    errorMessage: "Could not record payment.",
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
    buildBody: (form) => ({
      date: form.get("date"),
      amount: form.get("amount"),
      principal: form.get("principal") || undefined,
      interest: form.get("interest") || undefined,
      notes: form.get("notes") || undefined,
    }),
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-ledger-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-ledger"
      >
        + Record payment
      </button>
    );
  }

  const dateId = `loan-pay-date-${loanId}`;
  const amountId = `loan-pay-amount-${loanId}`;
  const principalId = `loan-pay-principal-${loanId}`;
  const interestId = `loan-pay-interest-${loanId}`;
  const notesId = `loan-pay-notes-${loanId}`;

  return (
    <form onSubmit={onSubmit} className="mt-3 grid gap-2">
      <div className="grid grid-cols-[1fr_1fr] gap-2">
        <div>
          <label htmlFor={dateId} className="mb-1 block text-[11px] text-muted-ledger">
            Date
          </label>
          <Input id={dateId} name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
        </div>
        <div>
          <label htmlFor={amountId} className="mb-1 block text-[11px] text-muted-ledger">
            Amount
          </label>
          <Input id={amountId} name="amount" inputMode="decimal" placeholder="Total payment" required />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-2">
        <div>
          <label htmlFor={principalId} className="mb-1 block text-[11px] text-muted-ledger">
            Principal (optional)
          </label>
          <Input id={principalId} name="principal" inputMode="decimal" placeholder="Auto-split" />
        </div>
        <div>
          <label htmlFor={interestId} className="mb-1 block text-[11px] text-muted-ledger">
            Interest (optional)
          </label>
          <Input id={interestId} name="interest" inputMode="decimal" placeholder="0" />
        </div>
      </div>
      <div>
        <label htmlFor={notesId} className="mb-1 block text-[11px] text-muted-ledger">
          Notes
        </label>
        <Input id={notesId} name="notes" placeholder="Notes" />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Saving..." : "Record"}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-ledger hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}
