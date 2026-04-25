import { ReactNode } from "react";
import { Plus, ScanLine } from "lucide-react";
import { MobileNav, SidebarNav } from "@/components/app/nav";
import { AIChatButton } from "@/components/app/ai-chat";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <SidebarNav />
      <main className="safe-top safe-bottom min-w-0 flex-1 pb-24 lg:pb-0">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
      <div className="fixed bottom-24 right-4 z-40 flex flex-col gap-3 lg:hidden">
        <Button asChild size="icon" variant="outline" aria-label="Scan receipt">
          <a href="/transactions?scan=1">
            <ScanLine className="h-5 w-5" />
          </a>
        </Button>
        <Button asChild size="icon" aria-label="Quick add transaction" className="h-14 w-14 rounded-full shadow-xl">
          <a href="/transactions?new=1">
            <Plus className="h-6 w-6" />
          </a>
        </Button>
      </div>
      <AIChatButton />
      <MobileNav />
    </div>
  );
}
