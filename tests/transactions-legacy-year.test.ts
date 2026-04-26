import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock auth so requireSession doesn't actually try to read a NextAuth session.
vi.mock("../auth", () => ({
  auth: () => Promise.resolve({ user: { id: "test-user" } }),
}));

// Mock prisma — both .findMany variants return an empty array; we only care
// about the response *shape* (bare array vs `{data, nextCursor}` envelope).
vi.mock("../src/lib/server/db", () => ({
  prisma: {
    transaction: {
      findMany: vi.fn(async () => []),
    },
  },
}));

// Mock getMadRate so the route's import doesn't pull in the live FX module.
vi.mock("../src/lib/server/rates", () => ({
  getMadRate: vi.fn(async () => 1),
}));

import { GET } from "../src/app/api/transactions/route";

function makeReq(query = "") {
  return new NextRequest(`http://localhost/api/transactions${query}`, { method: "GET" });
}

describe("GET /api/transactions — legacy `?year=` envelope vs cursor envelope (R6 partial regression)", () => {
  it("returns a bare array when only ?year= is supplied (legacy contract)", async () => {
    const res = await GET(makeReq("?year=2026"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("returns a bare array when no query params at all are supplied", async () => {
    const res = await GET(makeReq(""));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("returns the {data, nextCursor} envelope when ?limit= is present", async () => {
    const res = await GET(makeReq("?limit=10"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(false);
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("nextCursor");
  });

  it("returns the envelope when ?q= is present", async () => {
    const res = await GET(makeReq("?q=coffee"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("nextCursor");
  });

  it("returns the envelope when ?cursor= is present", async () => {
    const res = await GET(makeReq("?cursor=cuid_abc"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("nextCursor");
  });
});
