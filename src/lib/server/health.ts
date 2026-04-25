import { subDays } from "date-fns";
import { prisma } from "@/lib/server/db";
import { dashboardSummary } from "@/lib/server/analytics";

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export async function calculateFinancialHealthScore() {
  const [summary, emergency, loans, goals, incomeSources] = await Promise.all([
    dashboardSummary("COMBINED"),
    prisma.emergencyFundConfig.findFirst(),
    prisma.loan.aggregate({ where: { deletedAt: null }, _sum: { remainingBalanceCents: true, monthlyPaymentCents: true } }),
    prisma.goal.findMany({ where: { deletedAt: null } }),
    prisma.transaction.groupBy({
      by: ["counterparty"],
      where: { kind: "INCOME", deletedAt: null, date: { gte: subDays(new Date(), 90) } },
      _count: { _all: true },
    }),
  ]);

  const monthlyExpenses = Math.max(1, Math.round(summary.expenseCents / Math.max(1, new Date().getUTCMonth() + 1)));
  const emergencyMonths = (emergency?.currentBalanceCents ?? 0) / monthlyExpenses;
  const debtToIncome = summary.incomeCents <= 0 ? 100 : ((loans._sum.monthlyPaymentCents ?? 0) * 12) / summary.incomeCents;
  const goalProgress =
    goals.length === 0
      ? 50
      : goals.reduce((sum, goal) => sum + clamp((goal.currentSavedCents / Math.max(goal.targetAmountCents, 1)) * 100), 0) / goals.length;

  const distinctIncomeSources = incomeSources.filter((source) => source.counterparty && source._count._all > 0).length;
  const incomeDiversification =
    distinctIncomeSources >= 4 ? 100 : distinctIncomeSources === 3 ? 70 : distinctIncomeSources === 2 ? 40 : 0;

  const breakdown = {
    savingsRate: clamp(summary.savingsRate * 3),
    emergencyFund: clamp((emergencyMonths / 6) * 100),
    debtToIncome: clamp(100 - debtToIncome * 100),
    goalProgress: clamp(goalProgress),
    incomeDiversification,
  };

  const score = Math.round(
    breakdown.savingsRate * 0.25 +
      breakdown.emergencyFund * 0.25 +
      breakdown.debtToIncome * 0.2 +
      breakdown.goalProgress * 0.2 +
      breakdown.incomeDiversification * 0.1,
  );

  const today = new Date();
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return prisma.financialHealthScore.upsert({
    where: { date },
    create: { date, score, breakdown },
    update: { score, breakdown },
  });
}
