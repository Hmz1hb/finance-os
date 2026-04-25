"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useFormSubmit } from "@/lib/client/use-form-submit";

export function CategoryForm() {
  const router = useRouter();
  const { onSubmit, submitting } = useFormSubmit({
    url: "/api/categories",
    method: "POST",
    successMessage: "Category created.",
    errorMessage: "Could not create category.",
    onSuccess: () => router.refresh(),
    buildBody: (form) => ({
      name: form.get("name"),
      type: form.get("type"),
      context: form.get("context"),
      color: form.get("color") || undefined,
      icon: form.get("icon") || undefined,
    }),
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <label htmlFor="category-name" className="mb-1 block text-xs text-muted-ledger">
          Name
        </label>
        <Input id="category-name" name="name" placeholder="Category name" required />
      </div>
      <div>
        <label htmlFor="category-type" className="mb-1 block text-xs text-muted-ledger">
          Type
        </label>
        <Select id="category-type" name="type" defaultValue="EXPENSE">
          <option value="EXPENSE">Expense</option>
          <option value="INCOME">Income</option>
          <option value="TRANSFER">Transfer</option>
          <option value="ADJUSTMENT">Adjustment</option>
        </Select>
      </div>
      <div>
        <label htmlFor="category-context" className="mb-1 block text-xs text-muted-ledger">
          Context
        </label>
        <Select id="category-context" name="context" defaultValue="PERSONAL">
          <option value="PERSONAL">Personal</option>
          <option value="BUSINESS">Business</option>
          <option value="BOTH">Shared</option>
        </Select>
      </div>
      <div>
        <label htmlFor="category-color" className="mb-1 block text-xs text-muted-ledger">
          Color
        </label>
        <Input id="category-color" name="color" placeholder="#3aa0ff" />
      </div>
      <div>
        <label htmlFor="category-icon" className="mb-1 block text-xs text-muted-ledger">
          Icon
        </label>
        <Input id="category-icon" name="icon" placeholder="lucide icon name" />
      </div>
      <Button type="submit" disabled={submitting} className="md:col-span-2">
        {submitting ? "Saving..." : "Add category"}
      </Button>
    </form>
  );
}
