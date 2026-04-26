"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RowActions } from "@/components/app/row-actions";
import { EditDialog } from "@/components/app/edit-dialog";
import { TransactionEditForm } from "@/components/app/transaction-edit-form";
import { formatMad } from "@/lib/finance/money";
import { formatLocalYmd } from "@/lib/finance/date";
import type { Category, FinancialEntity } from "@prisma/client";

// LedgerTransaction is a thin shape — server payload includes `entity` and
// `category` relations; we keep dates as ISO strings since they cross the
// network as JSON.
export type LedgerTransaction = {
  id: string;
  date: string;
  kind: "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT";
  context: "PERSONAL" | "BUSINESS" | "BOTH";
  description: string;
  madEquivalentCents: number;
  amountCents: number;
  currency: "MAD" | "GBP" | "USD" | "EUR";
  categoryId: string | null;
  entityId: string | null;
  entity?: { name: string } | null;
  category?: { name: string } | null;
};

type Props = {
  initial: LedgerTransaction[];
  initialNextCursor: string | null;
  categories: Category[];
  entities: FinancialEntity[];
  // Captured server-side at render time so SSR + first hydration agree on
  // the "Scheduled" badge cutoff. Avoids React #418 from server/client time
  // skew without a setState-in-effect dance.
  serverNowMs: number;
};

const PAGE_SIZE = 50;

export function TransactionsLedger({ initial, initialNextCursor, categories, entities, serverNowMs }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<LedgerTransaction[]>(initial);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [editing, setEditing] = useState<LedgerTransaction | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const runSearch = useCallback(
    async (q: string, opts: { append?: boolean; cursor?: string | null } = {}) => {
      const myReq = ++requestIdRef.current;
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      if (q) params.set("q", q);
      if (opts.cursor) params.set("cursor", opts.cursor);
      try {
        const response = await fetch(`/api/transactions?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) {
          toast.error("Could not load transactions.");
          return;
        }
        const json = (await response.json()) as { data: LedgerTransaction[]; nextCursor: string | null };
        if (myReq !== requestIdRef.current) return;
        setRows((prev) => (opts.append ? [...prev, ...json.data] : json.data));
        setNextCursor(json.nextCursor);
      } catch {
        if (myReq === requestIdRef.current) toast.error("Could not load transactions.");
      }
    },
    [],
  );

  // Debounced search: schedules `runSearch` once the user stops typing for 300ms.
  // The Effect intentionally does no synchronous setState — the searching flag is
  // flipped inside the timeout callback after the await resolves, so React doesn't
  // re-render between every keystroke.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query === "" && rows === initial) return; // initial render — leave SSR data alone
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        await runSearch(query);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function loadMore() {
    if (!nextCursor || loading) return;
    setLoading(true);
    await runSearch(query, { append: true, cursor: nextCursor });
    setLoading(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          aria-label="Search transactions"
          placeholder="Search description..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {searching ? <span className="text-xs text-muted-ledger">Searching...</span> : null}
      </div>
      <div className="space-y-2">
        {rows.map((transaction) => {
          const txDate = new Date(transaction.date);
          const isFuture = txDate.getTime() > serverNowMs;
          return (
            <div key={transaction.id} className="grid grid-cols-[1fr_auto_auto] items-start gap-3 rounded-md bg-surface-inset p-3">
              <div>
                <p className="text-sm font-medium">
                  {transaction.description}
                  {isFuture ? (
                    <span className="ml-2 inline-flex items-center rounded-full bg-blue-ledger/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-ledger-fg">
                      Scheduled
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-ledger">
                  {formatLocalYmd(transaction.date)} · {transaction.entity?.name ?? transaction.context} · {transaction.category?.name ?? "Uncategorized"}
                </p>
              </div>
              <p className={transaction.kind === "INCOME" ? "text-sm font-semibold text-green-income" : "text-sm font-semibold text-red-risk"}>
                {formatMad(transaction.madEquivalentCents)}
              </p>
              <RowActions
                id={transaction.id}
                resource="transactions"
                onEdit={() => setEditing(transaction)}
              />
            </div>
          );
        })}
        {rows.length === 0 ? <p className="text-sm text-muted-ledger">No transactions yet.</p> : null}
      </div>
      {nextCursor ? (
        <div className="flex justify-center pt-2">
          <Button type="button" variant="ghost" onClick={loadMore} disabled={loading}>
            {loading ? "Loading..." : "Load more"}
          </Button>
        </div>
      ) : null}
      <EditDialog open={editing !== null} onClose={() => setEditing(null)} title="Edit transaction">
        {editing ? (
          <TransactionEditForm
            transaction={editing}
            categories={categories}
            entities={entities}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              router.refresh();
            }}
          />
        ) : null}
      </EditDialog>
    </div>
  );
}
