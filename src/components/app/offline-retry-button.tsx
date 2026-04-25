"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OfflineRetryButton() {
  return (
    <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
      <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry
    </Button>
  );
}
