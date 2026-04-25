"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

type Rate = { pair: string; rate: number; isManual?: boolean; source?: string | null };

type Props = {
  initialRates: Rate[];
  initialLastUpdated: string | null;
};

export function ExchangeRatesPanel({ initialRates, initialLastUpdated }: Props) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [, startTransition] = useTransition();
  const [lastUpdated, setLastUpdated] = useState(initialLastUpdated);

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const response = await fetch("/api/exchange-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh" }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        toast.error(body.error ?? "Could not refresh exchange rates");
        return;
      }
      const body = await response.json();
      if (body.lastUpdated) setLastUpdated(body.lastUpdated);
      toast.success("Exchange rates refreshed");
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Network error");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Exchange rates</CardTitle></CardHeader>
      <p className="mb-4 text-sm text-muted-ledger">
        Rates last updated: {lastUpdated ?? "never"}
      </p>
      <Button type="button" variant="outline" onClick={refresh} disabled={refreshing}>
        <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
        {refreshing ? "Refreshing…" : "Refresh"}
      </Button>
      <div className="mt-4 space-y-2">
        {initialRates.map((rate) => (
          <div key={rate.pair} className="flex justify-between rounded-md bg-surface-inset p-3 text-sm">
            <span>{rate.pair}</span>
            <span>{rate.rate.toFixed(4)} {rate.isManual ? "manual" : rate.source}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
