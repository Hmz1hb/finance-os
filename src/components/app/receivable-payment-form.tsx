"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReceivablePaymentForm({ receivableId }: { receivableId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/receivables/${receivableId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    const json = await response.json();
    setMessage(response.ok ? "Payment recorded." : json.error);
    if (response.ok) {
      event.currentTarget.reset();
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
      <Input name="amount" inputMode="decimal" placeholder="Payment amount" required />
      <Button type="submit" size="sm">Record</Button>
      {message ? <p className="text-xs text-muted-ledger sm:col-span-3">{message}</p> : null}
    </form>
  );
}
