import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { auth } from "../../../auth";
import { HttpError, type ZodIssueSummary } from "@/lib/server/errors";

export { HttpError } from "@/lib/server/errors";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    throw new HttpError(401, "Unauthorized");
  }
  return session;
}

function summarizeZodIssues(error: ZodError): ZodIssueSummary[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join(".") || "(root)",
    message: issue.message,
  }));
}

export async function parseJson<T>(request: NextRequest | Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, "Invalid request payload", summarizeZodIssues(result.error));
  }
  return result.data;
}

export function requireJsonContentType(request: NextRequest | Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json");
  }
}

export async function requireWriteAuth(request: NextRequest | Request) {
  requireJsonContentType(request);
  return requireSession();
}

export function jsonError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid request payload", issues: summarizeZodIssues(error) },
      { status: 400 },
    );
  }

  if (error instanceof HttpError) {
    return NextResponse.json(
      error.issues?.length
        ? { error: error.message, issues: error.issues }
        : { error: error.message },
      { status: error.status },
    );
  }

  const status =
    typeof error === "object" && error && "status" in error ? Number((error as { status: unknown }).status) : 500;
  const safeStatus = Number.isFinite(status) && status >= 400 && status < 600 ? status : 500;
  const message = safeStatus === 500 ? "Unexpected server error" : error instanceof Error ? error.message : "Request failed";
  return NextResponse.json({ error: message }, { status: safeStatus });
}
