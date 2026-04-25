import { NextResponse } from "next/server";
import { auth } from "./auth";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_WRITES = 60;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function clientKey(req: Request, userId?: string | null) {
  if (userId) return `user:${userId}`;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `ip:${forwarded ?? "unknown"}`;
}

function consumeRateBudget(key: string) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfter: 0 };
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_MAX_WRITES) {
    const retryAfter = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - bucket.windowStart)) / 1000));
    return { allowed: false, retryAfter };
  }
  return { allowed: true, retryAfter: 0 };
}

function jsonResponse(status: number, body: Record<string, unknown>, extraHeaders?: Record<string, string>) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...(extraHeaders ?? {}) },
  });
}

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = Boolean(req.auth);
  const path = nextUrl.pathname;
  const isApi = path.startsWith("/api/");
  const isApiAuth = path.startsWith("/api/auth/");
  const isAuthRoute = path.startsWith("/login") || isApiAuth;

  if (isApi && !isApiAuth) {
    const method = req.method.toUpperCase();
    const isWrite = !SAFE_METHODS.has(method);

    if (isWrite) {
      const contentType = req.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("application/json") && !contentType.toLowerCase().includes("multipart/form-data")) {
        return jsonResponse(415, { error: "Content-Type must be application/json" });
      }

      const origin = req.headers.get("origin");
      const host = req.headers.get("host");
      if (origin && host) {
        try {
          const originHost = new URL(origin).host;
          if (originHost !== host) {
            return jsonResponse(403, { error: "Origin does not match host" });
          }
        } catch {
          return jsonResponse(400, { error: "Invalid Origin header" });
        }
      }
    }

    if (isWrite && isLoggedIn) {
      const userId = req.auth?.user?.id ?? null;
      const key = clientKey(req, userId);
      const { allowed, retryAfter } = consumeRateBudget(key);
      if (!allowed) {
        return jsonResponse(
          429,
          { error: `Too many requests. Retry after ${retryAfter}s.` },
          { "retry-after": String(retryAfter) },
        );
      }
    }
  }

  if (!isLoggedIn && !isAuthRoute) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return Response.redirect(loginUrl);
  }

  if (isLoggedIn && nextUrl.pathname === "/login") {
    return Response.redirect(new URL("/dashboard", nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|screenshots|sw.js|workbox-.*|offline).*)"],
};
