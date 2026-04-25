"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { FinancialEntity } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";

export function LoanForm({ entities }: { entities: FinancialEntity[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    const json = await response.json();
    setMessage(response.ok ? "Loan added." : json.error);
    if (response.ok) {
      event.currentTarget.reset();
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
      <Input name="lenderName" placeholder="Lender / creditor" required />
      <Select name="kind" defaultValue="OWED_BY_ME">
        <option value="OWED_BY_ME">Owed by me</option>
        <option value="CREDIT_CARD">Credit card</option>
        <option value="BUSINESS_LOAN">Business loan</option>
        <option value="BNPL">BNPL</option>
      </Select>
      <Select name="entityId" defaultValue={entities[0]?.id}>
        {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
      </Select>
      <Select name="currency" defaultValue="MAD">
        <option>MAD</option>
        <option>GBP</option>
        <option>USD</option>
        <option>EUR</option>
      </Select>
      <Input name="originalAmount" inputMode="decimal" placeholder="Original amount" required />
      <Input name="remainingBalance" inputMode="decimal" placeholder="Remaining balance" required />
      <Input name="monthlyPayment" inputMode="decimal" placeholder="Monthly payment" required />
      <Input name="interestRate" inputMode="decimal" placeholder="Interest rate %" defaultValue="0" />
      <Input name="startDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
      <Input name="expectedPayoffDate" type="date" />
      <Textarea name="notes" className="md:col-span-2" placeholder="Notes" />
      {message ? <p className="text-sm text-muted-ledger md:col-span-2">{message}</p> : null}
      <Button type="submit" className="md:col-span-2">Add loan</Button>
    </form>
  );
}
