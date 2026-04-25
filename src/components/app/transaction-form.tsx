"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";

export function TransactionForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      date: form.get("date"),
      kind: form.get("kind"),
      context: form.get("context"),
      amount: form.get("amount"),
      currency: form.get("currency"),
      categoryId: form.get("categoryId") || undefined,
      description: form.get("description"),
      counterparty: form.get("counterparty"),
      paymentMethod: form.get("paymentMethod"),
      notes: form.get("notes"),
      taxDeductible: form.get("taxDeductible") === "on",
    };
    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!response.ok) {
      setMessage((await response.json()).error ?? "Could not save transaction");
      return;
    }
    (event.currentTarget as HTMLFormElement).reset();
    setMessage("Transaction saved.");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
      <Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
      <Select name="kind" defaultValue="EXPENSE">
        <option value="EXPENSE">Expense</option>
        <option value="INCOME">Income</option>
        <option value="TRANSFER">Transfer</option>
        <option value="ADJUSTMENT">Adjustment</option>
      </Select>
      <Select name="context" defaultValue="PERSONAL">
        <option value="PERSONAL">Personal</option>
        <option value="BUSINESS">Business</option>
        <option value="BOTH">Shared</option>
      </Select>
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <Input name="amount" inputMode="decimal" placeholder="Amount" required />
        <Select name="currency" defaultValue="MAD">
          <option>MAD</option>
          <option>GBP</option>
          <option>USD</option>
          <option>EUR</option>
        </Select>
      </div>
      <Select name="categoryId" defaultValue="">
        <option value="">Uncategorized</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>
      <Input name="counterparty" placeholder="Vendor, client, lender..." />
      <Input name="description" className="md:col-span-2" placeholder="Description" required />
      <Input name="paymentMethod" placeholder="Cash, card, PayPal, Stripe..." />
      <label className="flex h-10 items-center gap-2 rounded-md border border-ledger-border bg-surface-inset px-3 text-sm text-muted-ledger">
        <input name="taxDeductible" type="checkbox" className="accent-blue-ledger" />
        Tax deductible
      </label>
      <Textarea name="notes" className="md:col-span-2" placeholder="Notes" />
      {message ? <p className="text-sm text-muted-ledger md:col-span-2">{message}</p> : null}
      <Button type="submit" disabled={loading} className="md:col-span-2">
        {loading ? "Saving..." : "Save transaction"}
      </Button>
    </form>
  );
}
