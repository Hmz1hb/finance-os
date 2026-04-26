"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { FinancialEntity, Subscription } from "@prisma/client";
import { RowActions } from "@/components/app/row-actions";
import { EditDialog } from "@/components/app/edit-dialog";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatMoney } from "@/lib/finance/money";

type Props = {
  subscription: Subscription;
  entities: FinancialEntity[];
};

export function SubscriptionRow({ subscription, entities }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex items-start justify-between rounded-md bg-surface-inset p-3">
      <div>
        <p className="text-sm font-medium">{subscription.name}</p>
        <p className="text-xs text-muted-ledger">
          {subscription.context} · {subscription.category} · next {subscription.nextBillingDate.toISOString().slice(0, 10)}
        </p>
      </div>
      <div className="flex items-start gap-2">
        <p className="text-sm font-semibold">{formatMoney(subscription.amountCents, subscription.currency)}</p>
        <RowActions id={subscription.id} resource="subscriptions" onEdit={() => setEditing(true)} />
      </div>
      <EditDialog open={editing} onClose={() => setEditing(false)} title="Edit subscription">
        <SubscriptionEditForm
          subscription={subscription}
          entities={entities}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      </EditDialog>
    </div>
  );
}

function SubscriptionEditForm({
  subscription,
  entities,
  onClose,
  onSaved,
}: {
  subscription: Subscription;
  entities: FinancialEntity[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const body = {
      name: form.get("name"),
      context: form.get("context"),
      amount: form.get("amount"),
      currency: form.get("currency"),
      billingCycle: form.get("billingCycle"),
      nextBillingDate: form.get("nextBillingDate"),
      category: form.get("category"),
      status: form.get("status"),
      autoRenew: form.get("autoRenew") === "on",
      cancelUrl: form.get("cancelUrl") || null,
      entityId: form.get("entityId") || null,
    };
    try {
      const response = await fetch(`/api/subscriptions/${subscription.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string; issues?: Array<{ path: string; message: string }> };
        const message = json.issues?.length
          ? json.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
          : json.error ?? "Could not update subscription.";
        toast.error(message);
        return;
      }
      toast.success("Subscription updated.");
      onSaved();
    } catch {
      toast.error("Could not update subscription.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <label htmlFor="edit-sub-name" className="mb-1 block text-xs text-muted-ledger">Name</label>
        <Input id="edit-sub-name" name="name" defaultValue={subscription.name} required />
      </div>
      <div>
        <label htmlFor="edit-sub-context" className="mb-1 block text-xs text-muted-ledger">Context</label>
        <Select id="edit-sub-context" name="context" defaultValue={subscription.context}>
          <option value="PERSONAL">Personal</option>
          <option value="BUSINESS">Business</option>
          <option value="BOTH">Shared</option>
        </Select>
      </div>
      <div>
        <label htmlFor="edit-sub-entity" className="mb-1 block text-xs text-muted-ledger">Entity</label>
        <Select id="edit-sub-entity" name="entityId" defaultValue={subscription.entityId ?? ""}>
          <option value="">Unassigned</option>
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>{entity.name}</option>
          ))}
        </Select>
      </div>
      <div>
        <label htmlFor="edit-sub-amount" className="mb-1 block text-xs text-muted-ledger">Amount</label>
        <Input
          id="edit-sub-amount"
          name="amount"
          inputMode="decimal"
          defaultValue={(subscription.amountCents / 100).toFixed(2)}
          required
        />
      </div>
      <div>
        <label htmlFor="edit-sub-currency" className="mb-1 block text-xs text-muted-ledger">Currency</label>
        <Select id="edit-sub-currency" name="currency" defaultValue={subscription.currency}>
          <option>MAD</option>
          <option>GBP</option>
          <option>USD</option>
          <option>EUR</option>
        </Select>
      </div>
      <div>
        <label htmlFor="edit-sub-cycle" className="mb-1 block text-xs text-muted-ledger">Billing cycle</label>
        <Select id="edit-sub-cycle" name="billingCycle" defaultValue={subscription.billingCycle}>
          <option value="MONTHLY">Monthly</option>
          <option value="WEEKLY">Weekly</option>
          <option value="BIWEEKLY">Biweekly</option>
          <option value="QUARTERLY">Quarterly</option>
          <option value="YEARLY">Yearly</option>
        </Select>
      </div>
      <div>
        <label htmlFor="edit-sub-next" className="mb-1 block text-xs text-muted-ledger">Next billing date</label>
        <Input
          id="edit-sub-next"
          name="nextBillingDate"
          type="date"
          defaultValue={subscription.nextBillingDate.toISOString().slice(0, 10)}
          required
        />
      </div>
      <div>
        <label htmlFor="edit-sub-category" className="mb-1 block text-xs text-muted-ledger">Category</label>
        <Input id="edit-sub-category" name="category" defaultValue={subscription.category} required />
      </div>
      <div>
        <label htmlFor="edit-sub-status" className="mb-1 block text-xs text-muted-ledger">Status</label>
        <Select id="edit-sub-status" name="status" defaultValue={subscription.status}>
          <option value="ACTIVE">Active</option>
          <option value="TRIAL">Trial</option>
          <option value="PAUSED">Paused</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </div>
      <div>
        <label htmlFor="edit-sub-cancel-url" className="mb-1 block text-xs text-muted-ledger">Cancel URL</label>
        <Input id="edit-sub-cancel-url" name="cancelUrl" defaultValue={subscription.cancelUrl ?? ""} />
      </div>
      <label className="flex h-10 items-center gap-2 rounded-md border border-ledger-border bg-surface-inset px-3 text-sm text-muted-ledger md:col-span-2">
        <input
          name="autoRenew"
          type="checkbox"
          defaultChecked={subscription.autoRenew}
          className="accent-blue-ledger"
        />
        Auto-renew
      </label>
      <div className="flex items-center gap-2 md:col-span-2">
        <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save changes"}</Button>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
