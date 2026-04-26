import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock `./auth` so `auth(handler)` returns the handler directly and
// we don't attempt to resolve a real NextAuth session.
vi.mock("../auth", () => ({
  auth: (handler: (req: NextRequest & { auth: unknown }) => unknown) => {
    return (req: NextRequest, auth?: unknown) => {
      const augmented = req as NextRequest & { auth: unknown };
      augmented.auth = auth ?? null;
      return handler(augmented);
    };
  },
}));

import proxy from "../src/proxy";

function makeRequest(init: { method: string; contentType?: string; path?: string; origin?: string; host?: string }) {
  const url = `http://localhost:3000${init.path ?? "/api/transactions"}`;
  const headers: Record<string, string> = {};
  if (init.contentType) headers["content-type"] = init.contentType;
  if (init.origin) headers["origin"] = init.origin;
  if (init.host) headers["host"] = init.host;
  return new NextRequest(url, { method: init.method, headers });
}

describe("proxy CSRF / content-type guard", () => {
  it("rejects text/plain POST to /api/transactions with 415", async () => {
    const req = makeRequest({ method: "POST", contentType: "text/plain" });
    // Pass a fake authenticated session so we get past the auth gate
    // and reach the content-type check.
    const session = { user: { id: "test-user" } };
    const res = await (proxy as unknown as (r: NextRequest, a: unknown) => Promise<Response>)(req, session);
    expect(res).toBeDefined();
    expect(res!.status).toBe(415);
    const body = await res!.json();
    expect(body.error).toMatch(/Content-Type/i);
  });

  it("accepts application/json POST and lets it through (no 415)", async () => {
    const req = makeRequest({ method: "POST", contentType: "application/json" });
    const session = { user: { id: "test-user" } };
    const res = await (proxy as unknown as (r: NextRequest, a: unknown) => Promise<Response | undefined>)(req, session);
    // Either undefined (pass through) or NOT 415.
    if (res) expect(res.status).not.toBe(415);
  });

  it("accepts multipart/form-data POST (file upload) without 415", async () => {
    const req = makeRequest({ method: "POST", contentType: "multipart/form-data; boundary=----x" });
    const session = { user: { id: "test-user" } };
    const res = await (proxy as unknown as (r: NextRequest, a: unknown) => Promise<Response | undefined>)(req, session);
    if (res) expect(res.status).not.toBe(415);
  });

  it("does not gate GET on content-type", async () => {
    const req = makeRequest({ method: "GET" });
    const session = { user: { id: "test-user" } };
    const res = await (proxy as unknown as (r: NextRequest, a: unknown) => Promise<Response | undefined>)(req, session);
    if (res) expect(res.status).not.toBe(415);
  });
});
