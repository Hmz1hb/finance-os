"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";

type Resource =
  | "transactions"
  | "loans"
  | "goals"
  | "subscriptions"
  | "receivables"
  | "recurring-rules"
  | "expected-income"
  | "categories"
  | "owner-pay";

type Props = {
  id: string;
  resource: Resource;
  onEdit?: () => void;
  confirmMessage?: string;
};

export function RowActions({ id, resource, onEdit, confirmMessage }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function performDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/${resource}/${id}`, { method: "DELETE" });
      if (response.status === 204 || response.ok) {
        toast.success("Deleted");
        setConfirmOpen(false);
        setOpen(false);
        router.refresh();
        return;
      }
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      toast.error(json.error ?? "Could not delete");
    } catch {
      toast.error("Could not delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-ledger transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-ledger"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-8 z-50 min-w-[140px] overflow-hidden rounded-md border border-ledger-border bg-surface shadow-xl"
        >
          {onEdit ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              className="block w-full px-3 py-2 text-left text-xs text-foreground transition hover:bg-white/5"
            >
              Edit
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setConfirmOpen(true);
            }}
            className="block w-full px-3 py-2 text-left text-xs text-red-risk transition hover:bg-white/5"
          >
            Delete
          </button>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          if (!deleting) setConfirmOpen(false);
        }}
        onConfirm={performDelete}
        title="Delete this item?"
        message={confirmMessage ?? "This action cannot be undone."}
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        danger
      />
    </div>
  );
}
