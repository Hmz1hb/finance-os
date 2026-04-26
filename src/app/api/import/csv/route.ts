import { NextRequest, NextResponse } from "next/server";
import { ContextMode, Currency, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { toCents } from "@/lib/finance/money";
import { getMadRate } from "@/lib/server/rates";
import { HttpError, jsonError, requireSession } from "@/lib/server/http";

const REQUIRED_COLUMNS = ["amount", "date"];

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      throw new HttpError(415, "Expected multipart/form-data");
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new HttpError(415, "Expected multipart/form-data");
    }
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Missing CSV file");
    const text = await file.text();
    if (!text.trim()) throw new HttpError(400, "CSV file is empty");

    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2)
      throw new HttpError(
        400,
        `CSV must have a header row and at least one data row. Expected at minimum: ${REQUIRED_COLUMNS.join(", ")}`,
      );

    const [headerLine, ...rows] = lines;
    const headers = headerLine.split(",").map((header) => header.trim().toLowerCase());

    const missingColumns = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
    if (missingColumns.length > 0) {
      throw new HttpError(400, `CSV missing required columns: ${missingColumns.join(", ")}. Expected at minimum: ${REQUIRED_COLUMNS.join(", ")}`);
    }

    const parsedRows: Array<Record<string, string>> = [];
    for (const row of rows) {
      if (!row.trim()) continue;
      const cols = row.split(",").map((col) => col.trim());
      const item = Object.fromEntries(headers.map((header, index) => [header, cols[index] ?? ""]));
      parsedRows.push(item);
    }

    const validRows = parsedRows.filter((item) => {
      const date = new Date(item.date);
      const numericAmount = Number((item.amount || "0").replace(/,/g, ""));
      return !Number.isNaN(date.getTime()) && Number.isFinite(numericAmount) && numericAmount !== 0;
    });

    if (validRows.length === 0) {
      throw new HttpError(400, "CSV contains no rows with both a parseable date and a non-zero amount");
    }

    const created = [];
    for (const item of validRows) {
      const currency = (item.currency || "MAD").toUpperCase() as Currency;
      const rate = await getMadRate(currency);
      const amountCents = toCents(item.amount);
      created.push(
        await prisma.transaction.create({
          data: {
            date: new Date(item.date),
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

    return NextResponse.json({ imported: created.length, skipped: parsedRows.length - validRows.length });
  } catch (error) {
    return jsonError(error);
  }
}
