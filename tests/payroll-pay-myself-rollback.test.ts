import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Cluster F — wallet partial-write rollback. The route used to wrap only the
// balanced EXPENSE + INCOME `Transaction` rows in `prisma.$transaction([...])`
// and run `payrollPerson.upsert` + `payrollPayment.create` outside the
// transaction. A failure in step 3 or 4 left the two `Transaction` rows
// committed, and the Combined wallet card (src/lib/server/cockpit.ts —
// cashBalanceCents) read them as a phantom negative balance.
//
// The fix converts the route to the interactive `$transaction(async (tx) =>
// {...})` form so every write rolls back atomically on any failure. This
// test forces step 3 (`payrollPerson.upsert`) to throw and asserts that no
// Transaction rows remain.

vi.mock("../auth", () => ({
  auth: () => Promise.resolve({ user: { id: "test-user" } }),
}));

vi.mock("../src/lib/server/rates", () => ({
  getMadRate: vi.fn(async () => 1),
}));

// Track every Transaction row "created" inside or outside the interactive
// transaction. The mock $transaction below commits these rows only when the
// callback resolves; on rejection it rolls them back. That mirrors Prisma's
// real interactive-transaction semantics closely enough to prove the route
// no longer leaks half-writes.
type TransactionRow = {
  id: string;
  description: string;
  notes?: string | null;
  amountCents: number;
  madEquivalentCents: number;
  kind: string;
};

const dbState: { transactions: TransactionRow[] } = { transactions: [] };

let upsertShouldThrow = false;

vi.mock("../src/lib/server/db", () => {
  // Build a fresh `tx` handle per `$transaction` invocation so writes inside
  // the callback are staged and only committed once the callback resolves.
  function makeTx(staged: TransactionRow[]) {
    return {
      transaction: {
        create: vi.fn(async ({ data }: { data: Omit<TransactionRow, "id"> }) => {
          const row: TransactionRow = {
            id: `tx-${Math.random().toString(36).slice(2, 10)}`,
            ...data,
          };
          staged.push(row);
          return row;
        }),
      },
      payrollPerson: {
        upsert: vi.fn(async () => {
          if (upsertShouldThrow) {
            throw new Error("simulated payrollPerson.upsert failure");
          }
          return { id: "self" };
        }),
      },
      payrollPayment: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: "pay-1",
          ...data,
        })),
      },
    };
  }

  return {
    prisma: {
      financialEntity: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({
          id: where.id,
          type: "BUSINESS",
          baseCurrency: "MAD",
        })),
      },
      transaction: {
        findMany: vi.fn(async ({ where }: { where?: { notes?: { contains?: string } } } = {}) => {
          const needle = where?.notes?.contains;
          if (!needle) return [...dbState.transactions];
          return dbState.transactions.filter((row) => row.notes?.includes(needle));
        }),
      },
      $transaction: vi.fn(async (fn: (txArg: ReturnType<typeof makeTx>) => Promise<unknown>) => {
        const staged: TransactionRow[] = [];
        const tx = makeTx(staged);
        try {
          const result = await fn(tx);
          dbState.transactions.push(...staged);
          return result;
        } catch (error) {
          // Rollback — discard staged rows.
          throw error;
        }
      }),
    },
  };
});

import { POST } from "../src/app/api/payroll/pay-myself/route";

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/payroll/pay-myself", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  dbState.transactions = [];
  upsertShouldThrow = false;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/payroll/pay-myself — partial-write rollback (Cluster F)", () => {
  const validBody = {
    date: "2026-04-01",
    amount: 50,
    currency: "MAD",
    paymentType: "salary",
    notes: "ROLLBACK_TEST_NOTE_F",
    fromEntityId: "ent-from",
    toEntityId: "ent-to",
  };

  it("succeeds when every step resolves and commits both balanced transactions", async () => {
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(200);
    expect(dbState.transactions).toHaveLength(2);
  });

  it("rolls back the balanced transactions when payrollPerson.upsert fails", async () => {
    upsertShouldThrow = true;
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBeGreaterThanOrEqual(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();

    // The forced failure happens in step 3 (`payrollPerson.upsert`), AFTER
    // the two `tx.transaction.create` calls. With the old array-form
    // implementation those rows would already be committed; the interactive
    // form rolls them back. We assert that querying the test's note-prefix
    // returns 0 rows — i.e. full rollback.
    const { prisma } = await import("../src/lib/server/db");
    const leftover = await prisma.transaction.findMany({
      where: { notes: { contains: "ROLLBACK_TEST_NOTE_F" } },
    });
    expect(leftover).toHaveLength(0);
    expect(dbState.transactions).toHaveLength(0);
  });
});
