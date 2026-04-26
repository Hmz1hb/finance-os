"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

type Variant = "sidebar" | "mobile";

export function SignOutButton({ variant = "sidebar" }: { variant?: Variant }) {
  function onClick() {
    void signOut({ callbackUrl: "/login" });
  }

  if (variant === "mobile") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] text-muted-ledger"
        aria-label="Sign out"
      >
        <LogOut className="h-5 w-5" aria-hidden="true" />
        <span className="truncate">Sign out</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-ledger transition hover:bg-white/[0.04] hover:text-foreground"
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      Sign out
    </button>
  );
}
