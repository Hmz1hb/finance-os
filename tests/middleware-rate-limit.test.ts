import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock `./auth` so `auth(handler)` returns the handler directly.
vi.mock("../auth", () => ({
  auth: (handler: (req: NextRequest & { auth: unknown }) => unknown) => {
    return (req: NextRequest, auth?: unknown) => {
      const augmented = req as NextRequest & { auth: unknown };
      augmented.auth = auth ?? null;
      return handler(augmented);
    };
  },
}));

let middleware: typeof import("../middleware").default;

beforeEach(async () => {
  // Reset module state so the in-memory rate buckets are cleared between tests.
  vi.resetModules();
  middleware = (await import("../middleware")).default;
});

function makeWriteRequest(userId: string, path = "/api/transactions") {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.0.0.${userId.length}`,
    },
  });
}

function makeLoginRequest(ip: string) {
  return new NextRequest("http://localhost:3000/api/auth/callback/credentials", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": ip,
    },
  });
}

type Handler = (req: NextRequest, auth: unknown) => Promise<Response | undefined>;

describe("middleware rate limit on /api/transactions", () => {
  it("allows up to RATE_LIMIT_MAX_WRITES (30) writes then 429s the next", async () => {
    const session = { user: { id: "rate-user-1" } };
    const handler = middleware as unknown as Handler;

    // 30 should pass the rate-limit gate (status !== 429)
    for (let i = 0; i < 30; i++) {
      const res = await handler(makeWriteRequest("rate-user-1"), session);
      if (res) expect(res.status).not.toBe(429);
    }

    // 31st must trip
    const tripped = await handler(makeWriteRequest("rate-user-1"), session);
    expect(tripped).toBeDefined();
    expect(tripped!.status).toBe(429);
    const body = await tripped!.json();
    expect(body.error).toMatch(/Too many requests/i);
    expect(tripped!.headers.get("retry-after")).toBeTruthy();
  });
});

describe("middleware login rate limit on /api/auth/callback/credentials", () => {
  it("allows 10 attempts per IP then 429s the 11th", async () => {
    const handler = middleware as unknown as Handler;
    const ip = "203.0.113.42";

    for (let i = 0; i < 10; i++) {
      const res = await handler(makeLoginRequest(ip), null);
      if (res) expect(res.status).not.toBe(429);
    }

    const tripped = await handler(makeLoginRequest(ip), null);
    expect(tripped).toBeDefined();
    expect(tripped!.status).toBe(429);
    const body = await tripped!.json();
    expect(body.error).toMatch(/Too many login attempts/i);
  });
});
