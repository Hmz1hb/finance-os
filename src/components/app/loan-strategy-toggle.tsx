"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type Strategy = "snowball" | "avalanche";

const OPTIONS: { value: Strategy; label: string }[] = [
  { value: "snowball", label: "Snowball" },
  { value: "avalanche", label: "Avalanche" },
];

export function LoanStrategyToggle() {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = (params.get("strategy") === "avalanche" ? "avalanche" : "snowball") as Strategy;

  function buildHref(strategy: Strategy) {
    const next = new URLSearchParams(params.toString());
    next.set("strategy", strategy);
    return `${pathname}?${next.toString()}`;
  }

  return (
    <div
      role="tablist"
      aria-label="Debt payoff strategy"
      className="inline-flex rounded-md border border-ledger-border bg-surface-inset p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = current === option.value;
        return (
          <Link
            key={option.value}
            href={buildHref(option.value)}
            role="tab"
            aria-selected={active}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-ledger",
              active ? "bg-blue-ledger text-white" : "text-muted-ledger hover:text-foreground",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
