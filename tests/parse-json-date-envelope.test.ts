import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { addYears } from "date-fns";
import { TransactionType, ContextMode, Currency } from "@prisma/client";

vi.mock("../auth", () => ({
  auth: () => Promise.resolve({ user: { id: "test-user" } }),
}));

import { parseJson, HttpError } from "../src/lib/server/http";

const MAX_AMOUNT_CENTS = 1_000_000_000_000;
const MIN_DATE = new Date("1970-01-01T00:00:00.000Z");

const positiveAmount = z
  .union([z.string(), z.number()])
  .refine((value) => {
    const numeric = Number(typeof value === "string" ? value.replace(/,/g, "") : value);
    return Number.isFinite(numeric) && numeric > 0 && Math.round(numeric * 100) < MAX_AMOUNT_CENTS;
  }, { message: "Amount must be > 0 and within reasonable bounds" });

const transactionSchema = z.object({
  date: z.coerce
    .date()
    .refine((value) => value >= MIN_DATE && value <= addYears(new Date(), 5), {
      message: "Date must be between 1970 and 5 years from today",
    }),
  kind: z.enum(TransactionType),
  context: z.enum(ContextMode),
  amount: positiveAmount,
  currency: z.enum(Currency),
  description: z.string().min(1),
});

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/transactions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Transaction Zod date envelope (R4-V2 bug)", () => {
  it("does not surface 'expected date, received Date' when the date field is missing", async () => {
    const req = makeRequest({
      entityId: "morocco_personal",
      context: "PERSONAL",
      kind: "EXPENSE",
      amount: -1,
      currency: "MAD",
      description: "",
    });
    let envelope: { issues?: { path: string; message: string }[] } | null = null;
    try {
      await parseJson(req, transactionSchema);
    } catch (e) {
      if (e instanceof HttpError) {
        envelope = { issues: e.issues };
      } else {
        throw e;
      }
    }
    expect(envelope).not.toBeNull();
    const messages = envelope!.issues!.map((i) => `${i.path}: ${i.message}`);
    const stray = messages.find((m) => /expected date, received Date/i.test(m));
    expect(stray, `stray issue still present: ${stray}`).toBeUndefined();
    const dateIssue = envelope!.issues!.find((i) => i.path === "date");
    expect(dateIssue?.message).toMatch(/required|valid date/i);
  });

  it("still emits a friendly date issue with a coherent message", async () => {
    const req = makeRequest({
      context: "PERSONAL",
      kind: "EXPENSE",
      amount: 1,
      currency: "MAD",
      description: "x",
    });
    try {
      await parseJson(req, transactionSchema);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      const issues = (e as HttpError).issues ?? [];
      const dateIssue = issues.find((i) => i.path === "date");
      expect(dateIssue).toBeDefined();
      expect(dateIssue!.message).not.toMatch(/received Date/);
    }
  });
});
