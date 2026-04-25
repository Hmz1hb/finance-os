import { NextRequest, NextResponse } from "next/server";
import { ContextMode, Currency, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { getMadRate } from "@/lib/server/rates";
import { jsonError, requireSession } from "@/lib/server/http";

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Missing CSV file");
    const text = await file.text();
    const [headerLine, ...rows] = text.trim().split(/\r?\n/);
    const headers = headerLine.split(",").map((header) => header.trim().toLowerCase());
    const created = [];

    for (const row of rows) {
      const cols = row.split(",").map((col) => col.trim());
      const item = Object.fromEntries(headers.map((header, index) => [header, cols[index] ?? ""]));
      const currency = (item.currency || "MAD") as Currency;
      const rate = await getMadRate(currency);
      const amountCents = toCents(item.amount || "0");
      created.push(
        await prisma.transaction.create({
          data: {
            date: new Date(item.date || Date.now()),
            kind: ((item.kind || item.type || "EXPENSE").toUpperCase() as TransactionType) || TransactionType.EXPENSE,
            context: ((item.context || "PERSONAL").toUpperCase() as ContextMode) || ContextMode.PERSONAL,
            amountCents,
            currency,
            exchangeRateSnapshot: rate,
            madEquivalentCents: Math.round(amountCents * rate),
            description: item.description || item.vendor || "Imported transaction",
            counterparty: item.counterparty || item.vendor || undefined,
            paymentMethod: item.payment_method || undefined,
            tags: item.tags ? item.tags.split("|") : [],
          },
        }),
      );
    }

    return NextResponse.json({ imported: created.length });
  } catch (error) {
    return jsonError(error);
  }
}
