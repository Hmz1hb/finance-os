import Link from "next/link";
import type { ReactNode } from "react";
import { Building2, Globe2, Layers3 } from "lucide-react";
import { formatMad } from "@/lib/finance/money";
import { entityRailSummary } from "@/lib/server/cockpit";

export async function EntityRail() {
  const rows = await entityRailSummary().catch(() => []);
  const combined = rows.reduce(
    (acc, row) => ({
      cashCents: acc.cashCents + row.cashCents,
      expectedCents: acc.expectedCents + row.expectedCents,
      overdueReceivableCents: acc.overdueReceivableCents + row.overdueReceivableCents,
      taxReserveCents: acc.taxReserveCents + row.taxReserveCents,
    }),
    { cashCents: 0, expectedCents: 0, overdueReceivableCents: 0, taxReserveCents: 0 },
  );

  return (
    <section className="mb-5 grid gap-3 xl:grid-cols-3">
      <RailCard
        href="/dashboard?entity=combined"
        icon={<Layers3 className="h-4 w-4" />}
        name="Combined"
        label="All money worlds"
        cashCents={combined.cashCents}
        expectedCents={combined.expectedCents}
        overdueCents={combined.overdueReceivableCents}
        taxReserveCents={combined.taxReserveCents}
      />
      {rows.map((row) => (
        <RailCard
          key={row.entity.id}
          href={`/dashboard?entity=${row.entity.id}`}
          icon={row.entity.type === "UK_LTD" ? <Building2 className="h-4 w-4" /> : <Globe2 className="h-4 w-4" />}
          name={row.entity.name}
          label={`${row.entity.country} · ${row.entity.baseCurrency}`}
          cashCents={row.cashCents}
          expectedCents={row.expectedCents}
          overdueCents={row.overdueReceivableCents}
          taxReserveCents={row.taxReserveCents}
        />
      ))}
    </section>
  );
}

function RailCard({
  href,
  icon,
  name,
  label,
  cashCents,
  expectedCents,
  overdueCents,
  taxReserveCents,
}: {
  href: string;
  icon: ReactNode;
  name: string;
  label: string;
  cashCents: number;
  expectedCents: number;
  overdueCents: number;
  taxReserveCents: number;
}) {
  return (
    <Link href={href} className="block rounded-md border border-ledger-border bg-surface px-4 py-3 transition hover:border-blue-ledger/50 hover:bg-surface-elevated">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-surface-inset text-blue-ledger-fg">{icon}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted-ledger">{label}</p>
          </div>
        </div>
        <p className={cashCents >= 0 ? "text-sm font-semibold text-green-income" : "text-sm font-semibold text-red-risk"}>{formatMad(cashCents)}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-ledger">
        <span>Expected {formatMad(expectedCents)}</span>
        <span>Overdue {formatMad(overdueCents)}</span>
        <span>Reserve {formatMad(taxReserveCents)}</span>
      </div>
    </Link>
  );
}
