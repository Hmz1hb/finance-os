"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

export function PayMyselfForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/payroll/pay-myself", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    const json = await response.json();
    setMessage(response.ok ? "Linked business expense and personal income created as pending." : json.error);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
      <Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <Input name="amount" inputMode="decimal" placeholder="Amount" required />
        <Select name="currency" defaultValue="MAD">
          <option>MAD</option>
          <option>GBP</option>
          <option>USD</option>
          <option>EUR</option>
        </Select>
      </div>
      <Select name="paymentType" defaultValue="salary">
        <option value="salary">Salary</option>
        <option value="dividend">Dividend</option>
        <option value="drawings">Drawings</option>
      </Select>
      <Input name="notes" placeholder="Notes" />
      {message ? <p className="text-sm text-muted-ledger md:col-span-2">{message}</p> : null}
      <Button type="submit" className="md:col-span-2">Pay myself</Button>
    </form>
  );
}
