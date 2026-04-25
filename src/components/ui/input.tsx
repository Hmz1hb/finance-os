import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-ledger-border bg-surface-inset px-3 text-sm text-foreground outline-none transition placeholder:text-muted-ledger focus:border-blue-ledger focus:ring-2 focus:ring-blue-ledger/20",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-md border border-ledger-border bg-surface-inset px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-ledger focus:border-blue-ledger focus:ring-2 focus:ring-blue-ledger/20",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-ledger-border bg-surface-inset px-3 text-sm text-foreground outline-none transition focus:border-blue-ledger focus:ring-2 focus:ring-blue-ledger/20",
        className,
      )}
      {...props}
    />
  );
}
