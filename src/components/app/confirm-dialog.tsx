"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousActive = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Tab" && containerRef.current) {
        const focusables = containerRef.current.querySelectorAll<HTMLElement>(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousActive?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[1000] flex items-center justify-center"
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={containerRef}
        className="relative z-10 w-[min(420px,calc(100vw-2rem))] rounded-lg border border-ledger-border bg-surface p-5 shadow-xl"
      >
        <h2 id="confirm-dialog-title" className="text-base font-semibold text-foreground">
          {title}
        </h2>
        {message ? <p className="mt-2 text-sm text-muted-ledger">{message}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-md border border-ledger-border bg-surface px-3 text-xs font-medium text-foreground transition hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-ledger"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => {
              void onConfirm();
            }}
            className={cn(
              "inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-md px-3 text-xs font-medium text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-ledger",
              danger ? "bg-red-risk hover:bg-red-risk/90" : "bg-blue-ledger hover:bg-blue-ledger/90",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
