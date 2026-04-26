import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth so requireSession resolves to a logged-in user.
vi.mock("../auth", () => ({
  auth: () => Promise.resolve({ user: { id: "test-user" } }),
}));

// Mock the MAD FX module — keep rates simple and deterministic.
vi.mock("../src/lib/server/rates", () => ({
  getMadRate: vi.fn(async () => 1),
}));

// In-memory goal state used by all goal/contribution prisma calls.
type GoalRow = {
  id: string;
  currency: string;
  targetAmountCents: number;
  currentSavedCents: number;
  deletedAt: Date | null;
};

const goalState: { row: GoalRow } = {
  row: {
    id: "goal-1",
    currency: "MAD",
    targetAmountCents: 10_000,
    currentSavedCents: 0,
    deletedAt: null,
  },
};

// Mock prisma. The route uses:
//   prisma.goal.findFirst
//   prisma.$transaction(async (tx) => { tx.goalContribution.create; tx.goal.update })
vi.mock("../src/lib/server/db", () => {
  const tx = {
    goalContribution: {
      create: vi.fn(async ({ data }: { data: { amountCents: number } }) => ({
        id: `contrib-${Math.random().toString(36).slice(2, 10)}`,
        ...data,
      })),
    },
    goal: {
      update: vi.fn(async ({ data }: { data: { currentSavedCents: { increment: number } } }) => {
        goalState.row.currentSavedCents += data.currentSavedCents.increment;
        return { ...goalState.row };
      }),
    },
  };
  return {
    prisma: {
      goal: {
        findFirst: vi.fn(async () => ({ ...goalState.row })),
      },
      $transaction: vi.fn(async (fn: (txArg: typeof tx) => unknown) => fn(tx)),
    },
  };
});

import { POST } from "../src/app/api/goals/[id]/contributions/route";

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/goals/goal-1/contributions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

const ctx = { params: Promise.resolve({ id: "goal-1" }) };

beforeEach(() => {
  goalState.row = {
    id: "goal-1",
    currency: "MAD",
    targetAmountCents: 10_000,
    currentSavedCents: 0,
    deletedAt: null,
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/goals/[id]/contributions — over-target boundary (R9-FLOWS-001)", () => {
  it("accepts a partial contribution under the target (8000 of 10000)", async () => {
    const res = await POST(makePostRequest({ amount: 80 }), { params: ctx.params });
    expect(res.status).toBe(200);
    expect(goalState.row.currentSavedCents).toBe(8000);
  });

  it("rejects an over-target contribution with the remaining-cents error", async () => {
    goalState.row.currentSavedCents = 8000;
    const res = await POST(makePostRequest({ amount: 50 }), { params: ctx.params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Contribution exceeds remaining target/);
    expect(body.error).toMatch(/2000 cents remaining/);
    // State must not change on rejection.
    expect(goalState.row.currentSavedCents).toBe(8000);
  });

  it("accepts a contribution that lands exactly on the target", async () => {
    goalState.row.currentSavedCents = 8000;
    const res = await POST(makePostRequest({ amount: 20 }), { params: ctx.params });
    expect(res.status).toBe(200);
    expect(goalState.row.currentSavedCents).toBe(10_000);
  });

  it("rejects any contribution once the goal is fully funded (0 cents remaining)", async () => {
    goalState.row.currentSavedCents = 10_000;
    const res = await POST(makePostRequest({ amount: 0.01 }), { params: ctx.params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Contribution exceeds remaining target/);
    expect(body.error).toMatch(/0 cents remaining/);
    expect(goalState.row.currentSavedCents).toBe(10_000);
  });
});
