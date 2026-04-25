"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { FinancialEntity } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";

export function IncomeScheduleForm({ entities }: { entities: FinancialEntity[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/recurring-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    const json = await response.json();
    setMessage(response.ok ? "Expected income schedule created." : json.error);
    if (response.ok) {
      event.currentTarget.reset();
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
      <Input name="title" placeholder="Schedule name" required />
      <Input name="counterparty" placeholder="Client / platform" />
      <Select name="entityId" defaultValue={entities[0]?.id}>
        {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
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
      <Input name="startDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
      <Select name="cadence" defaultValue="INTERVAL_DAYS">
        <option value="INTERVAL_DAYS">Every N days</option>
        <option value="SEMI_MONTHLY">Semi-monthly</option>
        <option value="MONTHLY_DAY">Monthly day</option>
        <option value="WEEKLY">Weekly</option>
        <option value="BIWEEKLY">Biweekly</option>
        <option value="QUARTERLY">Quarterly</option>
        <option value="YEARLY">Yearly</option>
      </Select>
      <Input name="intervalDays" inputMode="numeric" placeholder="Interval days, e.g. 15" defaultValue="15" />
      <Input name="dayOfMonth" inputMode="numeric" placeholder="Day of month, e.g. 15" />
      <Input name="secondDayOfMonth" inputMode="numeric" placeholder="Second day, e.g. 31" />
      <Input name="endDate" type="date" />
      <Textarea name="notes" className="md:col-span-2" placeholder="Notes" />
      <input type="hidden" name="ruleType" value="EXPECTED_INCOME" />
      {message ? <p className="text-sm text-muted-ledger md:col-span-2">{message}</p> : null}
      <Button type="submit" className="md:col-span-2">Create schedule</Button>
    </form>
  );
}
