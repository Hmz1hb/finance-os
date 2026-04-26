"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Currency, FinancialEntity, RecurringCadence, RecurringRule, RecurringRuleType } from "@prisma/client";
import { RowActions } from "@/components/app/row-actions";
import { EditDialog } from "@/components/app/edit-dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { formatMoney } from "@/lib/finance/money";

type RuleWithEntity = RecurringRule & { entity: FinancialEntity };

type Props = {
  rule: RuleWithEntity;
};

export function RecurringRuleRow({ rule }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-md bg-surface-inset p-3">
      <div className="flex justify-between gap-3">
        <p className="text-sm font-medium">{rule.title}</p>
        <div className="flex items-start gap-2">
          <p className="text-sm font-semibold">{formatMoney(rule.amountCents, rule.currency)}</p>
          <RowActions id={rule.id} resource="recurring-rules" onEdit={() => setEditing(true)} />
        </div>
      </div>
      <p className="text-xs text-muted-ledger">
        {rule.entity.name} · {rule.cadence} · next {rule.nextDueDate.toISOString().slice(0, 10)}
      </p>
      <EditDialog open={editing} onClose={() => setEditing(false)} title="Edit recurring rule">
        <RecurringRuleEditForm
          rule={rule}
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

function RecurringRuleEditForm({
  rule,
  onClose,
  onSaved,
}: {
  rule: RuleWithEntity;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [cadence, setCadence] = useState<RecurringCadence>(rule.cadence);
  const isInterval = cadence === "INTERVAL_DAYS";
  const isMonthly = cadence === "MONTHLY_DAY" || cadence === "SEMI_MONTHLY";
  const isSemiMonthly = cadence === "SEMI_MONTHLY";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {
      title: form.get("title"),
      ruleType: form.get("ruleType") as RecurringRuleType,
      cadence: form.get("cadence") as RecurringCadence,
      startDate: form.get("startDate"),
      nextDueDate: form.get("nextDueDate"),
      endDate: form.get("endDate") || null,
      amount: form.get("amount"),
      currency: form.get("currency") as Currency,
      counterparty: form.get("counterparty") || null,
      autoCreate: form.get("autoCreate") === "on",
      notes: form.get("notes") || null,
      intervalDays: isInterval ? form.get("intervalDays") : null,
      dayOfMonth: isMonthly ? form.get("dayOfMonth") : null,
      secondDayOfMonth: isSemiMonthly ? form.get("secondDayOfMonth") : null,
    };
    try {
      const response = await fetch(`/api/recurring-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string; issues?: Array<{ path: string; message: string }> };
        const message = json.issues?.length
          ? json.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
          : json.error ?? "Could not update rule.";
        toast.error(message);
        return;
      }
      toast.success("Recurring rule updated.");
      onSaved();
    } catch {
      toast.error("Could not update rule.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <label htmlFor="edit-rule-title" className="mb-1 block text-xs text-muted-ledger">Title</label>
        <Input id="edit-rule-title" name="title" defaultValue={rule.title} required />
      </div>
      <div>
        <label htmlFor="edit-rule-type" className="mb-1 block text-xs text-muted-ledger">Rule type</label>
        <Select id="edit-rule-type" name="ruleType" defaultValue={rule.ruleType}>
          <option value="EXPECTED_INCOME">Expected income</option>
          <option value="EXPECTED_EXPENSE">Expected expense</option>
          <option value="RECEIVABLE">Receivable</option>
          <option value="SUBSCRIPTION">Subscription</option>
          <option value="OWNER_PAY">Owner pay</option>
        </Select>
      </div>
      <div>
        <label htmlFor="edit-rule-cadence" className="mb-1 block text-xs text-muted-ledger">Cadence</label>
        <Select
          id="edit-rule-cadence"
          name="cadence"
          value={cadence}
          onChange={(event) => setCadence(event.target.value as RecurringCadence)}
        >
          <option value="INTERVAL_DAYS">Every N days</option>
          <option value="SEMI_MONTHLY">Semi-monthly</option>
          <option value="MONTHLY_DAY">Monthly day</option>
          <option value="WEEKLY">Weekly</option>
          <option value="BIWEEKLY">Biweekly</option>
          <option value="QUARTERLY">Quarterly</option>
          <option value="YEARLY">Yearly</option>
        </Select>
      </div>
      {isInterval ? (
        <div>
          <label htmlFor="edit-rule-interval" className="mb-1 block text-xs text-muted-ledger">Interval days</label>
          <Input
            id="edit-rule-interval"
            name="intervalDays"
            inputMode="numeric"
            defaultValue={rule.intervalDays != null ? String(rule.intervalDays) : ""}
          />
        </div>
      ) : null}
      {isMonthly ? (
        <div>
          <label htmlFor="edit-rule-day" className="mb-1 block text-xs text-muted-ledger">Day of month</label>
          <Input
            id="edit-rule-day"
            name="dayOfMonth"
            inputMode="numeric"
            defaultValue={rule.dayOfMonth != null ? String(rule.dayOfMonth) : ""}
          />
        </div>
      ) : null}
      {isSemiMonthly ? (
        <div>
          <label htmlFor="edit-rule-second-day" className="mb-1 block text-xs text-muted-ledger">Second day</label>
          <Input
            id="edit-rule-second-day"
            name="secondDayOfMonth"
            inputMode="numeric"
            defaultValue={rule.secondDayOfMonth != null ? String(rule.secondDayOfMonth) : ""}
          />
        </div>
      ) : null}
      <div>
        <label htmlFor="edit-rule-amount" className="mb-1 block text-xs text-muted-ledger">Amount</label>
        <Input
          id="edit-rule-amount"
          name="amount"
          inputMode="decimal"
          defaultValue={(rule.amountCents / 100).toFixed(2)}
          required
        />
      </div>
      <div>
        <label htmlFor="edit-rule-currency" className="mb-1 block text-xs text-muted-ledger">Currency</label>
        <Select id="edit-rule-currency" name="currency" defaultValue={rule.currency}>
          <option>MAD</option>
          <option>GBP</option>
          <option>USD</option>
          <option>EUR</option>
        </Select>
      </div>
      <div>
        <label htmlFor="edit-rule-start" className="mb-1 block text-xs text-muted-ledger">Start date</label>
        <Input
          id="edit-rule-start"
          name="startDate"
          type="date"
          defaultValue={rule.startDate.toISOString().slice(0, 10)}
          required
        />
      </div>
      <div>
        <label htmlFor="edit-rule-next" className="mb-1 block text-xs text-muted-ledger">Next due date</label>
        <Input
          id="edit-rule-next"
          name="nextDueDate"
          type="date"
          defaultValue={rule.nextDueDate.toISOString().slice(0, 10)}
          required
        />
      </div>
      <div>
        <label htmlFor="edit-rule-end" className="mb-1 block text-xs text-muted-ledger">End date</label>
        <Input
          id="edit-rule-end"
          name="endDate"
          type="date"
          defaultValue={rule.endDate ? rule.endDate.toISOString().slice(0, 10) : ""}
        />
      </div>
      <div>
        <label htmlFor="edit-rule-counterparty" className="mb-1 block text-xs text-muted-ledger">Counterparty</label>
        <Input id="edit-rule-counterparty" name="counterparty" defaultValue={rule.counterparty ?? ""} />
      </div>
      <div className="flex items-center gap-2">
        <input
          id="edit-rule-auto"
          name="autoCreate"
          type="checkbox"
          defaultChecked={rule.autoCreate}
          className="h-4 w-4"
        />
        <label htmlFor="edit-rule-auto" className="text-xs text-muted-ledger">Auto-create transactions</label>
      </div>
      <div className="md:col-span-2">
        <label htmlFor="edit-rule-notes" className="mb-1 block text-xs text-muted-ledger">Notes</label>
        <Textarea id="edit-rule-notes" name="notes" defaultValue={rule.notes ?? ""} />
      </div>
      <div className="flex items-center gap-2 md:col-span-2">
        <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save changes"}</Button>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
