import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

vi.mock("../auth", () => ({
  auth: () => Promise.resolve({ user: { id: "test-user" } }),
}));

import { jsonError, HttpError } from "../src/lib/server/http";

describe("jsonError — Prisma P2002 unique-constraint mapping (R10)", () => {
  it("maps PrismaClientKnownRequestError P2002 to 409 with target", async () => {
    const err = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "7.8.0",
      meta: { target: ["entityId", "title", "cadence"] },
    });
    const res = jsonError(err);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Resource already exists");
    expect(body.target).toEqual(["entityId", "title", "cadence"]);
  });

  it("maps PrismaClientKnownRequestError P2002 with no meta.target to 409 with null target", async () => {
    const err = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "7.8.0",
    });
    const res = jsonError(err);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Resource already exists");
    expect(body.target).toBeNull();
  });

  it("does NOT remap non-P2002 known request errors to 409", async () => {
    const err = new Prisma.PrismaClientKnownRequestError("Record not found", {
      code: "P2025",
      clientVersion: "7.8.0",
    });
    const res = jsonError(err);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Unexpected server error");
  });
});

describe("jsonError — existing branches still pass", () => {
  it("ZodError → 400 with issues envelope", async () => {
    let zerr: ZodError;
    try {
      // synthesize a real ZodError
      const { z } = await import("zod");
      z.object({ a: z.string() }).parse({});
      throw new Error("expected throw");
    } catch (e) {
      zerr = e as ZodError;
    }
    const res = jsonError(zerr!);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request payload");
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it("HttpError → status + message preserved", async () => {
    const res = jsonError(new HttpError(404, "nope"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("nope");
  });

  it("HttpError with issues → status + issues preserved", async () => {
    const res = jsonError(new HttpError(400, "bad", [{ path: "x", message: "required" }]));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("bad");
    expect(body.issues).toEqual([{ path: "x", message: "required" }]);
  });

  it("unknown error → generic 500", async () => {
    const res = jsonError(new Error("boom"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Unexpected server error");
  });
});
