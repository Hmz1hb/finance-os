import { addDays, addMonths, addWeeks, addYears, endOfMonth } from "date-fns";
import type { RecurringCadence } from "@prisma/client";

type RecurrenceInput = {
  cadence: RecurringCadence;
  intervalDays?: number | null;
  dayOfMonth?: number | null;
  secondDayOfMonth?: number | null;
};

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day));
}

function clampDay(year: number, month: number, day: number) {
  const lastDay = endOfMonth(utcDate(year, month, 1)).getUTCDate();
  return Math.min(Math.max(1, day), lastDay);
}

function sameMonthDay(date: Date, day: number) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return utcDate(year, month, clampDay(year, month, day));
}

function nextMonthDay(date: Date, day: number) {
  const next = addMonths(utcDate(date.getUTCFullYear(), date.getUTCMonth(), 1), 1);
  return utcDate(next.getUTCFullYear(), next.getUTCMonth(), clampDay(next.getUTCFullYear(), next.getUTCMonth(), day));
}

export function nextRecurringRuleDate(date: Date, rule: RecurrenceInput) {
  switch (rule.cadence) {
    case "INTERVAL_DAYS":
      return addDays(date, rule.intervalDays ?? 15);
    case "DAILY":
      return addDays(date, 1);
    case "WEEKLY":
      return addWeeks(date, 1);
    case "BIWEEKLY":
      return addWeeks(date, 2);
    case "MONTHLY_DAY": {
      const day = rule.dayOfMonth ?? date.getUTCDate();
      return nextMonthDay(date, day);
    }
    case "SEMI_MONTHLY": {
      const first = rule.dayOfMonth ?? 15;
      const second = rule.secondDayOfMonth ?? 31;
      const secondThisMonth = sameMonthDay(date, second);
      if (date < secondThisMonth && date.getUTCDate() < clampDay(date.getUTCFullYear(), date.getUTCMonth(), second)) {
        return secondThisMonth;
      }
      return nextMonthDay(date, first);
    }
    case "QUARTERLY":
      return addMonths(date, 3);
    case "YEARLY":
      return addYears(date, 1);
  }
}

export function isPastEndDate(nextDate: Date, endDate?: Date | null) {
  return Boolean(endDate && nextDate > endDate);
}
