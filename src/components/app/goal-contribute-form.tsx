"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormSubmit } from "@/lib/client/use-form-submit";

export function GoalContributeForm({ goalId }: { goalId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { onSubmit, submitting } = useFormSubmit({
    url: `/api/goals/${goalId}/contributions`,
    method: "POST",
    successMessage: "Contribution recorded.",
    errorMessage: "Could not record contribution.",
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
    buildBody: (form) => ({
      date: form.get("date"),
      amount: form.get("amount"),
      notes: form.get("notes") || undefined,
    }),
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-ledger-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-ledger"
      >
        + Contribute
      </button>
    );
  }

  const dateId = `goal-contribute-date-${goalId}`;
  const amountId = `goal-contribute-amount-${goalId}`;
  const notesId = `goal-contribute-notes-${goalId}`;

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
          <Input id={amountId} name="amount" inputMode="decimal" placeholder="Amount" required />
        </div>
      </div>
      <div>
        <label htmlFor={notesId} className="mb-1 block text-[11px] text-muted-ledger">
          Notes
        </label>
        <Input id={notesId} name="notes" placeholder="Optional notes" />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Saving..." : "Record"}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted-ledger hover:underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
