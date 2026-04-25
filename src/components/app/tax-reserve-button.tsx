"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function TaxReserveButton({ entityId, label }: { entityId: string; label: string }) {
  const router = useRouter();

  async function createReserve() {
    await fetch("/api/tax/estimates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityId, createReserve: true }),
    });
    router.refresh();
  }

  return <Button type="button" variant="outline" size="sm" onClick={createReserve}>{label}</Button>;
}
