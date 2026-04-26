"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Category, ContextMode, TransactionType } from "@prisma/client";
import { RowActions } from "@/components/app/row-actions";
import { EditDialog } from "@/components/app/edit-dialog";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

type Props = {
  category: Category;
};

export function CategoryRow({ category }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex items-start justify-between gap-2 rounded-md bg-surface-inset p-3">
      <div>
        <p className="text-sm font-medium">{category.name}</p>
        <p className="text-xs text-muted-ledger">
          {category.context} · {category.type}
          {category.isSystem ? " · system" : ""}
        </p>
      </div>
      {category.isSystem ? null : (
        <RowActions id={category.id} resource="categories" onEdit={() => setEditing(true)} />
      )}
      <EditDialog open={editing} onClose={() => setEditing(false)} title="Edit category">
        <CategoryEditForm
          category={category}
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

function CategoryEditForm({
  category,
  onClose,
  onSaved,
}: {
  category: Category;
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
      type: form.get("type") as TransactionType,
      context: form.get("context") as ContextMode,
      color: form.get("color") || null,
      icon: form.get("icon") || null,
    };
    try {
      const response = await fetch(`/api/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string; issues?: Array<{ path: string; message: string }> };
        const message = json.issues?.length
          ? json.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
          : json.error ?? "Could not update category.";
        toast.error(message);
        return;
      }
      toast.success("Category updated.");
      onSaved();
    } catch {
      toast.error("Could not update category.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <label htmlFor="edit-category-name" className="mb-1 block text-xs text-muted-ledger">Name</label>
        <Input id="edit-category-name" name="name" defaultValue={category.name} required minLength={2} />
      </div>
      <div>
        <label htmlFor="edit-category-type" className="mb-1 block text-xs text-muted-ledger">Type</label>
        <Select id="edit-category-type" name="type" defaultValue={category.type}>
          <option value="EXPENSE">Expense</option>
          <option value="INCOME">Income</option>
          <option value="TRANSFER">Transfer</option>
          <option value="ADJUSTMENT">Adjustment</option>
        </Select>
      </div>
      <div>
        <label htmlFor="edit-category-context" className="mb-1 block text-xs text-muted-ledger">Context</label>
        <Select id="edit-category-context" name="context" defaultValue={category.context}>
          <option value="PERSONAL">Personal</option>
          <option value="BUSINESS">Business</option>
          <option value="BOTH">Shared</option>
        </Select>
      </div>
      <div>
        <label htmlFor="edit-category-color" className="mb-1 block text-xs text-muted-ledger">Color</label>
        <Input id="edit-category-color" name="color" defaultValue={category.color ?? ""} placeholder="#3aa0ff" />
      </div>
      <div>
        <label htmlFor="edit-category-icon" className="mb-1 block text-xs text-muted-ledger">Icon</label>
        <Input id="edit-category-icon" name="icon" defaultValue={category.icon ?? ""} placeholder="lucide icon name" />
      </div>
      <div className="flex items-center gap-2 md:col-span-2">
        <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save changes"}</Button>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
