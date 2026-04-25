"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { FinancialEntity } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";

export function ReceivableForm({ entities }: { entities: FinancialEntity[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/receivables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    const json = await response.json();
    setMessage(response.ok ? "Receivable created." : json.error);
    if (response.ok) {
      event.currentTarget.reset();
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
      <Input name="title" placeholder="What are they paying for?" required />
      <Input name="counterparty" placeholder="Who owes you?" required />
      <Select name="entityId" defaultValue={entities[0]?.id}>
        {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
      </Select>
      <Select name="kind" defaultValue="CLIENT_INVOICE">
        <option value="CLIENT_INVOICE">Client invoice</option>
        <option value="PERSONAL_IOU">Personal IOU</option>
        <option value="BUSINESS_RECEIVABLE">Business receivable</option>
        <option value="OTHER">Other</option>
      </Select>
      <Input name="issueDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
      <Input name="dueDate" type="date" />
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <Input name="amount" inputMode="decimal" placeholder="Amount" required />
        <Select name="currency" defaultValue="MAD">
          <option>MAD</option>
          <option>GBP</option>
          <option>USD</option>
          <option>EUR</option>
        </Select>
      </div>
      <Input name="source" placeholder="Invoice number / source" />
      <Textarea name="notes" className="md:col-span-2" placeholder="Notes" />
      {message ? <p className="text-sm text-muted-ledger md:col-span-2">{message}</p> : null}
      <Button type="submit" className="md:col-span-2">Add receivable</Button>
    </form>
  );
}
