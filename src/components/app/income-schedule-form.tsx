"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FinancialEntity } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useFormSubmit } from "@/lib/client/use-form-submit";

export function IncomeScheduleForm({ entities }: { entities: FinancialEntity[] }) {
  const router = useRouter();
  const [cadence, setCadence] = useState("INTERVAL_DAYS");
  const isInterval = cadence === "INTERVAL_DAYS";

  const { onSubmit, submitting } = useFormSubmit({
    url: "/api/recurring-rules",
    method: "POST",
    successMessage: "Expected income schedule created.",
    errorMessage: "Could not create schedule.",
    onSuccess: () => router.refresh(),
    buildBody: (form) => Object.fromEntries(form),
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
      <div>
        <label htmlFor="schedule-title" className="mb-1 block text-xs text-muted-ledger">
          Schedule name
        </label>
        <Input id="schedule-title" name="title" placeholder="Schedule name" required />
      </div>
      <div>
        <label htmlFor="schedule-counterparty" className="mb-1 block text-xs text-muted-ledger">
          Client / platform
        </label>
        <Input id="schedule-counterparty" name="counterparty" placeholder="Client / platform" />
      </div>
      <div>
        <label htmlFor="schedule-entity" className="mb-1 block text-xs text-muted-ledger">
          Entity
        </label>
        <Select id="schedule-entity" name="entityId" defaultValue={entities[0]?.id}>
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <div>
          <label htmlFor="schedule-amount" className="mb-1 block text-xs text-muted-ledger">
            Amount
          </label>
          <Input id="schedule-amount" name="amount" inputMode="decimal" placeholder="Amount" required />
        </div>
        <div>
          <label htmlFor="schedule-currency" className="mb-1 block text-xs text-muted-ledger">
            Currency
          </label>
          <Select id="schedule-currency" name="currency" defaultValue="MAD">
            <option>MAD</option>
            <option>GBP</option>
            <option>USD</option>
            <option>EUR</option>
          </Select>
        </div>
      </div>
      <div>
        <label htmlFor="schedule-start-date" className="mb-1 block text-xs text-muted-ledger">
          Start date
        </label>
        <Input
          id="schedule-start-date"
          name="startDate"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
        />
      </div>
      <div>
        <label htmlFor="schedule-cadence" className="mb-1 block text-xs text-muted-ledger">
          Cadence
        </label>
        <Select
          id="schedule-cadence"
          name="cadence"
          value={cadence}
          onChange={(event) => setCadence(event.target.value)}
        >
          <option value="INTERVAL_DAYS">Every N days</option>
          <option value="SEMI_MONTHLY">Semi-monthly</option>
          <option value="MONTHLY_DAY">Monthly day</option>
          <option value="WEEKLY">Weekly</option>
          <option value="BIWEEKLY">Biweekly</option>
          <option value="QUARTERLY">Quarterly</option>
          <option value="YEARLY">Yearly</option>
        </Select>
      </div>
      <div>
        <label htmlFor="schedule-interval" className="mb-1 block text-xs text-muted-ledger">
          Interval days
        </label>
        <Input
          id="schedule-interval"
          name="intervalDays"
          inputMode="numeric"
          placeholder="e.g. 15"
          defaultValue="15"
        />
      </div>
      {!isInterval ? (
        <>
          <div>
            <label htmlFor="schedule-day" className="mb-1 block text-xs text-muted-ledger">
              Day of month
            </label>
            <Input
              id="schedule-day"
              name="dayOfMonth"
              inputMode="numeric"
              placeholder="e.g. 15"
            />
          </div>
          <div>
            <label htmlFor="schedule-second-day" className="mb-1 block text-xs text-muted-ledger">
              Second day
            </label>
            <Input
              id="schedule-second-day"
              name="secondDayOfMonth"
              inputMode="numeric"
              placeholder="e.g. 31"
            />
          </div>
          <div>
            <label htmlFor="schedule-end-date" className="mb-1 block text-xs text-muted-ledger">
              End date
            </label>
            <Input id="schedule-end-date" name="endDate" type="date" />
          </div>
        </>
      ) : null}
      <div className="md:col-span-2">
        <label htmlFor="schedule-notes" className="mb-1 block text-xs text-muted-ledger">
          Notes
        </label>
        <Textarea id="schedule-notes" name="notes" placeholder="Notes" />
      </div>
      <input type="hidden" name="ruleType" value="EXPECTED_INCOME" />
      <Button type="submit" disabled={submitting} className="md:col-span-2">
        {submitting ? "Saving..." : "Create schedule"}
      </Button>
    </form>
  );
}
