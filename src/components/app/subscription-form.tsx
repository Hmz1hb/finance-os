"use client";

import { useRouter } from "next/navigation";
import type { FinancialEntity } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useFormSubmit } from "@/lib/client/use-form-submit";

export function SubscriptionForm({ entities }: { entities: FinancialEntity[] }) {
  const router = useRouter();
  const { onSubmit, submitting } = useFormSubmit({
    url: "/api/subscriptions",
    method: "POST",
    successMessage: "Subscription added.",
    errorMessage: "Could not add subscription.",
    onSuccess: () => router.refresh(),
    buildBody: (form) => ({
      name: form.get("name"),
      context: form.get("context"),
      amount: form.get("amount"),
      currency: form.get("currency"),
      billingCycle: form.get("billingCycle"),
      nextBillingDate: form.get("nextBillingDate"),
      autoRenew: form.get("autoRenew") === "on",
      category: form.get("category"),
      cancelUrl: form.get("cancelUrl") || undefined,
      entityId: form.get("entityId") || undefined,
    }),
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <label htmlFor="sub-name" className="mb-1 block text-xs text-muted-ledger">
          Name
        </label>
        <Input id="sub-name" name="name" placeholder="Netflix, Vercel, etc." required />
      </div>
      <div>
        <label htmlFor="sub-context" className="mb-1 block text-xs text-muted-ledger">
          Context
        </label>
        <Select id="sub-context" name="context" defaultValue="PERSONAL">
          <option value="PERSONAL">Personal</option>
          <option value="BUSINESS">Business</option>
          <option value="BOTH">Shared</option>
        </Select>
      </div>
      <div>
        <label htmlFor="sub-category" className="mb-1 block text-xs text-muted-ledger">
          Category
        </label>
        <Input id="sub-category" name="category" placeholder="Tools, media, hosting..." required />
      </div>
      <div className="grid grid-cols-[1fr_96px] gap-2 md:col-span-2">
        <div>
          <label htmlFor="sub-amount" className="mb-1 block text-xs text-muted-ledger">
            Amount
          </label>
          <Input id="sub-amount" name="amount" inputMode="decimal" placeholder="Amount" required />
        </div>
        <div>
          <label htmlFor="sub-currency" className="mb-1 block text-xs text-muted-ledger">
            Currency
          </label>
          <Select id="sub-currency" name="currency" defaultValue="MAD">
            <option>MAD</option>
            <option>GBP</option>
            <option>USD</option>
            <option>EUR</option>
          </Select>
        </div>
      </div>
      <div>
        <label htmlFor="sub-billing-cycle" className="mb-1 block text-xs text-muted-ledger">
          Billing cycle
        </label>
        <Select id="sub-billing-cycle" name="billingCycle" defaultValue="MONTHLY">
          <option value="DAILY">Daily</option>
          <option value="WEEKLY">Weekly</option>
          <option value="BIWEEKLY">Biweekly</option>
          <option value="MONTHLY">Monthly</option>
          <option value="QUARTERLY">Quarterly</option>
          <option value="YEARLY">Yearly</option>
        </Select>
      </div>
      <div>
        <label htmlFor="sub-next-billing-date" className="mb-1 block text-xs text-muted-ledger">
          Next billing
        </label>
        <Input
          id="sub-next-billing-date"
          name="nextBillingDate"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
        />
      </div>
      <div>
        <label htmlFor="sub-cancel-url" className="mb-1 block text-xs text-muted-ledger">
          Cancel URL
        </label>
        <Input id="sub-cancel-url" name="cancelUrl" placeholder="https://..." />
      </div>
      <div>
        <label htmlFor="sub-entity" className="mb-1 block text-xs text-muted-ledger">
          Entity
        </label>
        <Select id="sub-entity" name="entityId" defaultValue="">
          <option value="">Unassigned</option>
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.name}
            </option>
          ))}
        </Select>
      </div>
      <label className="md:col-span-2 flex h-10 items-center gap-2 rounded-md border border-ledger-border bg-surface-inset px-3 text-sm text-muted-ledger">
        <input name="autoRenew" type="checkbox" defaultChecked className="accent-blue-ledger" />
        Auto-renew
      </label>
      <Button type="submit" disabled={submitting} className="md:col-span-2">
        {submitting ? "Saving..." : "Add subscription"}
      </Button>
    </form>
  );
}
