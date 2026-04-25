"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormSubmit } from "@/lib/client/use-form-submit";

export function ReceivablePaymentForm({ receivableId }: { receivableId: string }) {
  const router = useRouter();
  const { onSubmit, submitting } = useFormSubmit({
    url: `/api/receivables/${receivableId}/payments`,
    method: "POST",
    successMessage: "Payment recorded.",
    errorMessage: "Could not record payment.",
    onSuccess: () => router.refresh(),
    buildBody: (form) => Object.fromEntries(form),
  });

  const dateId = `recpay-date-${receivableId}`;
  const amountId = `recpay-amount-${receivableId}`;

  return (
    <form onSubmit={onSubmit} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
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
        <Input id={amountId} name="amount" inputMode="decimal" placeholder="Payment amount" required />
      </div>
      <div className="flex items-end">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Saving..." : "Record"}
        </Button>
      </div>
    </form>
  );
}
