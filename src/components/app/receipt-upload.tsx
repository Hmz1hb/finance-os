"use client";

import { FormEvent, useState } from "react";
import { ScanLine, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReceiptUpload() {
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setResult("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/ai/receipt-ocr", { method: "POST", body: form });
    const json = await response.json();
    setResult(JSON.stringify(json, null, 2));
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="receipt-file" className="mb-1 block text-xs text-muted-ledger">
        Receipt image
      </label>
      <Input
        id="receipt-file"
        name="file"
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        required
        aria-label="Upload receipt image"
      />
      <Button type="submit" variant="outline" disabled={loading}>
        {loading ? <ScanLine className="h-4 w-4 animate-pulse" /> : <UploadCloud className="h-4 w-4" />}
        {loading ? "Reading receipt..." : "Scan receipt with AI"}
      </Button>
      {result ? <pre className="max-h-72 overflow-auto rounded-md bg-surface-inset p-3 text-xs text-muted-ledger">{result}</pre> : null}
    </form>
  );
}
