"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { FinancialEntity, Goal } from "@prisma/client";
import { GoalCategory } from "@prisma/client";
import { RowActions } from "@/components/app/row-actions";
import { EditDialog } from "@/components/app/edit-dialog";
import { GoalContributeForm } from "@/components/app/goal-contribute-form";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { formatMoney } from "@/lib/finance/money";

type Props = {
  goal: Goal;
  entities: FinancialEntity[];
};

export function GoalRow({ goal, entities }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const pct = (goal.currentSavedCents / Math.max(goal.targetAmountCents, 1)) * 100;

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{goal.name}</h2>
          <p className="mt-1 text-xs text-muted-ledger">{goal.category} · priority {goal.priority}</p>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-sm font-semibold">{Math.round(pct)}%</span>
          <RowActions id={goal.id} resource="goals" onEdit={() => setEditing(true)} />
        </div>
      </div>
      <Progress value={pct} />
      <p className="mt-3 text-xs text-muted-ledger">
        {formatMoney(goal.currentSavedCents, goal.currency)} / {formatMoney(goal.targetAmountCents, goal.currency)}
      </p>
      <GoalContributeForm goalId={goal.id} />
      <EditDialog open={editing} onClose={() => setEditing(false)} title="Edit goal">
        <GoalEditForm
          goal={goal}
          entities={entities}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      </EditDialog>
    </Card>
  );
}

function GoalEditForm({
  goal,
  entities,
  onClose,
  onSaved,
}: {
  goal: Goal;
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
      targetAmount: form.get("targetAmount"),
      currentSaved: form.get("currentSaved"),
      currency: form.get("currency"),
      category: form.get("category"),
      priority: form.get("priority"),
      targetDate: form.get("targetDate") || null,
      entityId: form.get("entityId") || null,
      notes: form.get("notes") || null,
    };
    try {
      const response = await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string; issues?: Array<{ path: string; message: string }> };
        const message = json.issues?.length
          ? json.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
          : json.error ?? "Could not update goal.";
        toast.error(message);
        return;
      }
      toast.success("Goal updated.");
      onSaved();
    } catch {
      toast.error("Could not update goal.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <label htmlFor="edit-goal-name" className="mb-1 block text-xs text-muted-ledger">Name</label>
        <Input id="edit-goal-name" name="name" defaultValue={goal.name} required />
      </div>
      <div>
        <label htmlFor="edit-goal-target" className="mb-1 block text-xs text-muted-ledger">Target amount</label>
        <Input
          id="edit-goal-target"
          name="targetAmount"
          inputMode="decimal"
          defaultValue={(goal.targetAmountCents / 100).toFixed(2)}
        />
      </div>
      <div>
        <label htmlFor="edit-goal-saved" className="mb-1 block text-xs text-muted-ledger">Current saved</label>
        <Input
          id="edit-goal-saved"
          name="currentSaved"
          inputMode="decimal"
          defaultValue={(goal.currentSavedCents / 100).toFixed(2)}
        />
      </div>
      <div>
        <label htmlFor="edit-goal-currency" className="mb-1 block text-xs text-muted-ledger">Currency</label>
        <Select id="edit-goal-currency" name="currency" defaultValue={goal.currency}>
          <option>MAD</option>
          <option>GBP</option>
          <option>USD</option>
          <option>EUR</option>
        </Select>
      </div>
      <div>
        <label htmlFor="edit-goal-category" className="mb-1 block text-xs text-muted-ledger">Category</label>
        <Select id="edit-goal-category" name="category" defaultValue={goal.category}>
          {Object.values(GoalCategory).map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </Select>
      </div>
      <div>
        <label htmlFor="edit-goal-priority" className="mb-1 block text-xs text-muted-ledger">Priority (1–5)</label>
        <Input
          id="edit-goal-priority"
          name="priority"
          type="number"
          min={1}
          max={5}
          defaultValue={String(goal.priority)}
        />
      </div>
      <div>
        <label htmlFor="edit-goal-date" className="mb-1 block text-xs text-muted-ledger">Target date</label>
        <Input
          id="edit-goal-date"
          name="targetDate"
          type="date"
          defaultValue={goal.targetDate ? goal.targetDate.toISOString().slice(0, 10) : ""}
        />
      </div>
      <div>
        <label htmlFor="edit-goal-entity" className="mb-1 block text-xs text-muted-ledger">Entity</label>
        <Select id="edit-goal-entity" name="entityId" defaultValue={goal.entityId ?? ""}>
          <option value="">Unassigned</option>
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>{entity.name}</option>
          ))}
        </Select>
      </div>
      <div className="md:col-span-2">
        <label htmlFor="edit-goal-notes" className="mb-1 block text-xs text-muted-ledger">Notes</label>
        <Textarea id="edit-goal-notes" name="notes" defaultValue={goal.notes ?? ""} />
      </div>
      <div className="flex items-center gap-2 md:col-span-2">
        <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save changes"}</Button>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
