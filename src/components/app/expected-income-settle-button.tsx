"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Props = {
  id: string;
};

// Small client button that POSTs to /api/expected-income/[id]/settle and refreshes
// the page. The endpoint is idempotent — a 409 just means "already settled" so we
// surface that as info rather than as a hard error.
export function ExpectedIncomeSettleButton({ id }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function settle() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/expected-income/${id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (response.status === 409) {
        toast.info("Already marked received.");
        router.refresh();
        return;
      }
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string };
        toast.error(json.error ?? "Could not mark received.");
        return;
      }
      toast.success("Marked received.");
      router.refresh();
    } catch {
      toast.error("Could not mark received.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={settle}
      disabled={submitting}
      className="inline-flex items-center rounded-md border border-ledger-border bg-surface px-2 py-1 text-[11px] font-medium text-foreground transition hover:bg-surface-elevated disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-ledger"
    >
      {submitting ? "Saving..." : "Mark received"}
    </button>
  );
}
