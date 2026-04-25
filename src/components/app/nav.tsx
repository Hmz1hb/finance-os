import Link from "next/link";
import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  CalendarClock,
  CreditCard,
  Flag,
  Gauge,
  Home,
  Landmark,
  Layers3,
  ListChecks,
  PanelTop,
  PiggyBank,
  Receipt,
  Repeat,
  Settings,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Cash cockpit", icon: Gauge },
      { href: "/transactions", label: "Ledger", icon: Receipt },
      { href: "/reports", label: "Reports", icon: CalendarClock },
    ],
  },
  {
    label: "Entities",
    items: [
      { href: "/business", label: "UK LTD", icon: BriefcaseBusiness },
      { href: "/personal", label: "Morocco personal", icon: Home },
    ],
  },
  {
    label: "Cash in",
    items: [
      { href: "/business/income", label: "Revenue", icon: BarChart3 },
      { href: "/income-schedules", label: "Expected income", icon: Repeat },
      { href: "/receivables", label: "Receivables", icon: PanelTop },
    ],
  },
  {
    label: "Cash out",
    items: [
      { href: "/business/expenses", label: "Business costs", icon: CreditCard },
      { href: "/personal/expenses", label: "Spending", icon: Wallet },
      { href: "/payroll", label: "Owner pay", icon: Landmark },
      { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
    ],
  },
  {
    label: "Owed / plan",
    items: [
      { href: "/loans", label: "Loans", icon: ListChecks },
      { href: "/personal/emergency-fund", label: "Runway", icon: PiggyBank },
      { href: "/goals", label: "Goals", icon: Flag },
      { href: "/net-worth", label: "Net worth", icon: Layers3 },
      { href: "/business/tax", label: "Tax reserve", icon: Landmark },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/ai", label: "Advisor", icon: Bot },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const mobileItems = [
  navGroups[0].items[0],
  navGroups[0].items[1],
  navGroups[2].items[1],
  navGroups[2].items[2],
  navGroups[4].items[4],
];

export function SidebarNav() {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-ledger-border bg-background px-4 py-5 lg:block">
      <div className="mb-6 px-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-ledger">Finance OS</p>
        <h1 className="mt-2 text-xl font-semibold">Cash cockpit</h1>
      </div>
      <nav className="space-y-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[11px] uppercase tracking-[0.16em] text-muted-ledger">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-ledger transition hover:bg-white/[0.04] hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export function MobileNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-ledger-border bg-background/95 px-2 py-2 backdrop-blur lg:hidden">
      <div className="grid grid-cols-5 gap-1">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] text-muted-ledger">
              <Icon className="h-5 w-5" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
