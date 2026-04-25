"use client";

import { useRouter } from "next/navigation";
import type { FinancialEntity } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useFormSubmit } from "@/lib/client/use-form-submit";

export function GoalForm({ entities }: { entities: FinancialEntity[] }) {
  const router = useRouter();
  const { onSubmit, submitting } = useFormSubmit({
    url: "/api/goals",
    method: "POST",
    successMessage: "Goal created.",
    errorMessage: "Could not create goal.",
    onSuccess: () => router.refresh(),
    buildBody: (form) => ({
      name: form.get("name"),
      targetAmount: form.get("targetAmount"),
      currency: form.get("currency"),
      currentSaved: form.get("currentSaved") || undefined,
      targetDate: form.get("targetDate") || undefined,
      priority: form.get("priority") || undefined,
      category: form.get("category"),
      entityId: form.get("entityId") || undefined,
      notes: form.get("notes") || undefined,
    }),
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <label htmlFor="goal-name" className="mb-1 block text-xs text-muted-ledger">
          Name
        </label>
        <Input id="goal-name" name="name" placeholder="Goal name" required />
      </div>
      <div className="grid grid-cols-[1fr_96px] gap-2 md:col-span-2">
        <div>
          <label htmlFor="goal-target-amount" className="mb-1 block text-xs text-muted-ledger">
            Target amount
          </label>
          <Input id="goal-target-amount" name="targetAmount" inputMode="decimal" placeholder="Target" required />
        </div>
        <div>
          <label htmlFor="goal-currency" className="mb-1 block text-xs text-muted-ledger">
            Currency
          </label>
          <Select id="goal-currency" name="currency" defaultValue="MAD">
            <option>MAD</option>
            <option>GBP</option>
            <option>USD</option>
            <option>EUR</option>
          </Select>
        </div>
      </div>
      <div>
        <label htmlFor="goal-current-saved" className="mb-1 block text-xs text-muted-ledger">
          Already saved
        </label>
        <Input id="goal-current-saved" name="currentSaved" inputMode="decimal" placeholder="0" />
      </div>
      <div>
        <label htmlFor="goal-target-date" className="mb-1 block text-xs text-muted-ledger">
          Target date
        </label>
        <Input id="goal-target-date" name="targetDate" type="date" />
      </div>
      <div>
        <label htmlFor="goal-priority" className="mb-1 block text-xs text-muted-ledger">
          Priority (1 highest)
        </label>
        <Select id="goal-priority" name="priority" defaultValue="3">
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
        </Select>
      </div>
      <div>
        <label htmlFor="goal-category" className="mb-1 block text-xs text-muted-ledger">
          Category
        </label>
        <Select id="goal-category" name="category" defaultValue="NEEDS">
          <option value="NEEDS">Needs</option>
          <option value="WANTS">Wants</option>
          <option value="BUSINESS">Business</option>
          <option value="INVESTMENT">Investment</option>
        </Select>
      </div>
      <div className="md:col-span-2">
        <label htmlFor="goal-entity" className="mb-1 block text-xs text-muted-ledger">
          Entity
        </label>
        <Select id="goal-entity" name="entityId" defaultValue="">
          <option value="">Unassigned</option>
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="md:col-span-2">
        <label htmlFor="goal-notes" className="mb-1 block text-xs text-muted-ledger">
          Notes
        </label>
        <Textarea id="goal-notes" name="notes" placeholder="Notes" />
      </div>
      <Button type="submit" disabled={submitting} className="md:col-span-2">
        {submitting ? "Saving..." : "Add goal"}
      </Button>
    </form>
  );
}
