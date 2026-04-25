import { WifiOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { OfflineRetryButton } from "@/components/app/offline-retry-button";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[70dvh] items-center justify-center">
      <Card className="max-w-md text-center">
        <WifiOff className="mx-auto mb-4 h-10 w-10 text-orange-deadline" aria-hidden="true" />
        <h1 className="text-xl font-semibold">Offline mode</h1>
        <p className="mt-2 text-sm leading-6 text-muted-ledger">
          The app shell is available, but this page needs a network connection or cached finance data.
        </p>
        <OfflineRetryButton />
      </Card>
    </div>
  );
}
