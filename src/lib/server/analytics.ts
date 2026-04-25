import { subMonths, startOfMonth, endOfMonth, addDays } from "date-fns";
import { ContextMode, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import { savingsRate } from "@/lib/finance/money";

export async function dashboardSummary(context: ContextMode | "COMBINED" = "COMBINED", year = new Date().getFullYear()) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const contextWhere = context === "COMBINED" ? {} : { context };
  const transactions = await prisma.transaction.findMany({
    where: { deletedAt: null, date: { gte: start, lt: end }, ...contextWhere },
    include: { category: true },
    orderBy: { date: "desc" },
    take: 500,
  });

  const incomeCents = transactions
    .filter((transaction) => transaction.kind === TransactionType.INCOME)
    .reduce((sum, transaction) => sum + transaction.madEquivalentCents, 0);
  const expenseCents = transactions
    .filter((transaction) => transaction.kind === TransactionType.EXPENSE)
    .reduce((sum, transaction) => sum + Math.abs(transaction.madEquivalentCents), 0);

  const byCategory = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.kind !== TransactionType.EXPENSE) continue;
    const label = transaction.category?.name ?? transaction.subcategory ?? "Uncategorized";
    byCategory.set(label, (byCategory.get(label) ?? 0) + Math.abs(transaction.madEquivalentCents));
  }

  const monthly = Array.from({ length: 12 }, (_, month) => ({
    month: new Date(Date.UTC(year, month, 1)).toLocaleString("en-US", { month: "short" }),
    income: 0,
    expenses: 0,
  }));
  for (const transaction of transactions) {
    const bucket = monthly[transaction.date.getUTCMonth()];
    if (transaction.kind === TransactionType.INCOME) bucket.income += transaction.madEquivalentCents / 100;
    if (transaction.kind === TransactionType.EXPENSE) bucket.expenses += Math.abs(transaction.madEquivalentCents) / 100;
  }

  const upcoming = await prisma.recurringTemplate.findMany({
    where: {
      deletedAt: null,
      nextDueDate: { gte: new Date(), lte: addDays(new Date(), 30) },
      ...(context === "COMBINED" ? {} : { context }),
    },
    orderBy: { nextDueDate: "asc" },
    take: 8,
  });

  const subscriptions = await prisma.subscription.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      nextBillingDate: { gte: new Date(), lte: addDays(new Date(), 30) },
      ...(context === "COMBINED" ? {} : { context }),
    },
    orderBy: { nextBillingDate: "asc" },
    take: 8,
  });

  const netWorth = await prisma.netWorthSnapshot.findFirst({ orderBy: { snapshotDate: "desc" } });
  const goals = await prisma.goal.findMany({ where: { deletedAt: null }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }], take: 8 });
  const debt = await prisma.loan.aggregate({ where: { deletedAt: null }, _sum: { remainingBalanceCents: true, monthlyPaymentCents: true } });

  return {
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    savingsRate: savingsRate(incomeCents, expenseCents),
    netWorthCents: netWorth?.netWorthCents ?? 0,
    debtCents: debt._sum.remainingBalanceCents ?? 0,
    monthlyDebtCents: debt._sum.monthlyPaymentCents ?? 0,
    subscriptionBurnCents: subscriptions.reduce((sum, sub) => sum + sub.madEquivalentCents, 0),
    recentTransactions: transactions.slice(0, 12),
    categoryBreakdown: [...byCategory.entries()].map(([name, value]) => ({ name, value: value / 100 })).slice(0, 8),
    monthly,
    upcoming,
    subscriptions,
    goals,
  };
}

export async function financialContextSnapshot() {
  const since = startOfMonth(subMonths(new Date(), 3));
  const until = endOfMonth(new Date());
  const [transactions, goals, loans, subscriptions, netWorth, invoices] = await Promise.all([
    prisma.transaction.findMany({
      where: { deletedAt: null, date: { gte: since, lte: until } },
      include: { category: true },
      orderBy: { date: "desc" },
      take: 400,
    }),
    prisma.goal.findMany({ where: { deletedAt: null }, orderBy: { priority: "asc" } }),
    prisma.loan.findMany({ where: { deletedAt: null }, orderBy: { remainingBalanceCents: "desc" } }),
    prisma.subscription.findMany({ where: { deletedAt: null, status: "ACTIVE" }, orderBy: { nextBillingDate: "asc" } }),
    prisma.netWorthSnapshot.findFirst({ orderBy: { snapshotDate: "desc" } }),
    prisma.invoice.findMany({ where: { deletedAt: null, status: { in: ["PENDING", "INVOICED", "LATE", "DISPUTED"] } }, orderBy: { dueDate: "asc" } }),
  ]);

  const income = transactions.filter((item) => item.kind === "INCOME").reduce((sum, item) => sum + item.madEquivalentCents, 0);
  const expenses = transactions.filter((item) => item.kind === "EXPENSE").reduce((sum, item) => sum + Math.abs(item.madEquivalentCents), 0);

  return {
    generatedAt: new Date().toISOString(),
    period: { since, until },
    incomeMadCents: income,
    expenseMadCents: expenses,
    savingsRate: savingsRate(income, expenses),
    topExpenseCategories: Object.entries(
      transactions
        .filter((item) => item.kind === "EXPENSE")
        .reduce<Record<string, number>>((acc, item) => {
          const key = item.category?.name ?? "Uncategorized";
          acc[key] = (acc[key] ?? 0) + Math.abs(item.madEquivalentCents);
          return acc;
        }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
    goals: goals.map((goal) => ({
      name: goal.name,
      currentSavedCents: goal.currentSavedCents,
      targetAmountCents: goal.targetAmountCents,
      currency: goal.currency,
      targetDate: goal.targetDate,
    })),
    loans: loans.map((loan) => ({
      lenderName: loan.lenderName,
      kind: loan.kind,
      remainingBalanceCents: loan.remainingBalanceCents,
      monthlyPaymentCents: loan.monthlyPaymentCents,
      currency: loan.currency,
      expectedPayoffDate: loan.expectedPayoffDate,
    })),
    subscriptions: subscriptions.map((sub) => ({
      name: sub.name,
      context: sub.context,
      madEquivalentCents: sub.madEquivalentCents,
      nextBillingDate: sub.nextBillingDate,
      billingCycle: sub.billingCycle,
    })),
    netWorthCents: netWorth?.netWorthCents ?? 0,
    outstandingInvoices: invoices.map((invoice) => ({
      invoiceNumber: invoice.invoiceNumber,
      source: invoice.source,
      status: invoice.status,
      madEquivalentCents: invoice.madEquivalentCents,
      dueDate: invoice.dueDate,
    })),
  };
}
