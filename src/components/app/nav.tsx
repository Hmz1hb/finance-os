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
  PiggyBank,
  Receipt,
  Repeat,
  Settings,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/business", label: "Business", icon: BriefcaseBusiness },
  { href: "/business/income", label: "Revenue", icon: BarChart3 },
  { href: "/business/expenses", label: "Business Costs", icon: CreditCard },
  { href: "/payroll", label: "Payroll", icon: Landmark },
  { href: "/personal", label: "Personal", icon: Home },
  { href: "/personal/expenses", label: "Spending", icon: Wallet },
  { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
  { href: "/loans", label: "Debt", icon: ListChecks },
  { href: "/personal/emergency-fund", label: "Runway", icon: PiggyBank },
  { href: "/goals", label: "Goals", icon: Flag },
  { href: "/net-worth", label: "Net Worth", icon: Layers3 },
  { href: "/reports", label: "Reports", icon: CalendarClock },
  { href: "/ai", label: "Advisor", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
];

const mobileItems = navItems.slice(0, 5);

export function SidebarNav() {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-ledger-border bg-background px-4 py-5 lg:block">
      <div className="mb-6 px-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-ledger">Finance OS</p>
        <h1 className="mt-2 text-xl font-semibold">Cash cockpit</h1>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-2 px-2">
        <select className="h-9 rounded-md border border-ledger-border bg-surface-inset px-2 text-xs text-foreground">
          <option>Combined</option>
          <option>Personal</option>
          <option>Business</option>
        </select>
        <select className="h-9 rounded-md border border-ledger-border bg-surface-inset px-2 text-xs text-foreground" defaultValue={new Date().getFullYear()}>
          {Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - index).map((year) => (
            <option key={year}>{year}</option>
          ))}
        </select>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
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
