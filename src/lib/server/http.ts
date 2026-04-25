import { NextResponse } from "next/server";
import { auth } from "../../../auth";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  return session;
}

export function jsonError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unexpected server error" },
    { status: Number.isFinite(status) ? status : 500 },
  );
}
