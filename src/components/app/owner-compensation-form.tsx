"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";

export function OwnerCompensationForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/owner-pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    const json = await response.json();
    setMessage(response.ok ? "Owner compensation recorded with linked transactions." : json.error);
    if (response.ok) {
      event.currentTarget.reset();
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
      <Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <Input name="amount" inputMode="decimal" placeholder="Amount" required />
        <Select name="currency" defaultValue="GBP">
          <option>GBP</option>
          <option>MAD</option>
          <option>USD</option>
          <option>EUR</option>
        </Select>
      </div>
      <Select name="paymentType" defaultValue="DIVIDEND">
        <option value="SALARY">Salary</option>
        <option value="DIVIDEND">Dividend</option>
        <option value="DIRECTOR_LOAN">Director loan</option>
        <option value="REIMBURSEMENT">Reimbursement</option>
        <option value="DRAWINGS">Drawings</option>
        <option value="OTHER">Other</option>
      </Select>
      <Input name="taxTreatment" placeholder="Tax treatment override" />
      <Textarea name="notes" className="md:col-span-2" placeholder="Notes" />
      {message ? <p className="text-sm text-muted-ledger md:col-span-2">{message}</p> : null}
      <Button type="submit" className="md:col-span-2">Record owner pay</Button>
    </form>
  );
}
