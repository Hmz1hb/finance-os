import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addYears } from "date-fns";
import { ContextMode, Currency, TransactionType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { jsonError, parseJson, requireSession } from "@/lib/server/http";
import { getMadRate } from "@/lib/server/rates";
import { MOROCCO_PERSONAL_ENTITY_ID, UK_LTD_ENTITY_ID } from "@/lib/server/entities";

const MAX_AMOUNT_CENTS = 1_000_000_000_000;
const MIN_DATE = new Date("1970-01-01T00:00:00.000Z");
const IDEMPOTENCY_TTL_MS = 60_000;
const idempotencyCache = new Map<string, { transactionId: string; expiresAt: number }>();

function reapIdempotency(now: number) {
  for (const [key, value] of idempotencyCache) {
    if (value.expiresAt < now) idempotencyCache.delete(key);
  }
}

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
  categoryId: z.string().optional().nullable(),
  subcategory: z.string().optional().nullable(),
  description: z.string().min(1),
  counterparty: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  isRecurring: z.coerce.boolean().default(false),
  taxDeductible: z.coerce.boolean().default(false),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  entityId: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const params = request.nextUrl.searchParams;
    const context = params.get("context");
    const entityId = params.get("entityId");
    const cursor = params.get("cursor");
    const q = params.get("q")?.trim();
    const limitRaw = params.get("limit");
    const limitParam = limitRaw !== null ? Number(limitRaw) : NaN;
    const yearParam = params.get("year");

    // Cursor-paginated mode: when `cursor`, `limit`, or `q` is present we switch
    // off the legacy "give me a whole year up to 300 rows" envelope and return
    // `{ data, nextCursor }` instead. The `limitRaw` check is intentional —
    // `Number(null)` is 0 (a finite number), so checking finiteness alone would
    // flip every legacy `?year=` caller to the envelope.
    const usePagination = cursor !== null || q !== undefined || (limitRaw !== null && Number.isFinite(limitParam));
    if (usePagination) {
      const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 50, 1), 100);
      const where: Prisma.TransactionWhereInput = {
        deletedAt: null,
        ...(entityId && entityId !== "combined" ? { entityId } : {}),
        ...(context && context !== "COMBINED" ? { context: context as ContextMode } : {}),
        ...(q ? { description: { contains: q, mode: "insensitive" } } : {}),
      };
      const rows = await prisma.transaction.findMany({
        where,
        include: { category: true, attachments: true, entity: true },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;
      return NextResponse.json({ data, nextCursor });
    }

    // Legacy envelope: bare array, scoped to a calendar year, hard-capped at 300.
    const year = Number(yearParam ?? new Date().getFullYear());
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    const transactions = await prisma.transaction.findMany({
      where: {
        deletedAt: null,
        date: { gte: start, lt: end },
        ...(entityId && entityId !== "combined" ? { entityId } : {}),
        ...(context && context !== "COMBINED" ? { context: context as ContextMode } : {}),
      },
      include: { category: true, attachments: true },
      orderBy: { date: "desc" },
      take: 300,
    });
    return NextResponse.json(transactions);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSession();

    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (idempotencyKey) {
      const now = Date.now();
      reapIdempotency(now);
      const cached = idempotencyCache.get(idempotencyKey);
      if (cached) {
        const transaction = await prisma.transaction.findFirst({
          where: { id: cached.transactionId, deletedAt: null },
          include: { category: true },
        });
        if (transaction) return NextResponse.json(transaction);
      }
    }

    const parsed = await parseJson(request, transactionSchema);
    const amountCents = toCents(parsed.amount);
    const exchangeRateSnapshot = await getMadRate(parsed.currency);
    const entityId = parsed.entityId ?? (parsed.context === ContextMode.BUSINESS ? UK_LTD_ENTITY_ID : MOROCCO_PERSONAL_ENTITY_ID);
    const transaction = await prisma.transaction.create({
      data: {
        date: parsed.date,
        kind: parsed.kind,
        context: parsed.context,
        entityId,
        amountCents,
        currency: parsed.currency,
        exchangeRateSnapshot,
        madEquivalentCents: Math.round(amountCents * exchangeRateSnapshot),
        categoryId: parsed.categoryId ?? undefined,
        subcategory: parsed.subcategory ?? undefined,
        description: parsed.description,
        counterparty: parsed.counterparty ?? undefined,
        source: parsed.source ?? undefined,
        paymentMethod: parsed.paymentMethod ?? undefined,
        isRecurring: parsed.isRecurring,
        taxDeductible: parsed.taxDeductible,
        notes: parsed.notes ?? undefined,
        tags: parsed.tags,
      },
      include: { category: true },
    });

    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, {
        transactionId: transaction.id,
        expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
      });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    return jsonError(error);
  }
}
