import { subDays } from "date-fns";
import { prisma } from "@/lib/server/db";
import { dashboardSummary } from "@/lib/server/analytics";

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

const EMERGENCY_FUND_MIN_MONTHS_OF_HISTORY = 3;

export type EmergencyFundProjection =
  | {
      status: "ok";
      monthlyAverageCents: number;
      targetCents: number;
      monthsOfHistory: number;
    }
  | {
      status: "insufficient_history";
      monthsOfHistory: number;
      requiredMonths: number;
    };

/**
 * Compute the emergency-fund auto-target from personal expenses.
 *
 * Returns "insufficient_history" when fewer than 3 distinct calendar months
 * of expense data exist — multiplying a noisy 1-2 week sample by 6 produces
 * meaningless targets, so the UI should surface an empty state instead.
 */
export async function emergencyFundProjection(opts?: {
  entityId?: string;
  targetMonths?: number;
}): Promise<EmergencyFundProjection> {
  const entityId = opts?.entityId ?? "morocco_personal";
  const targetMonths = opts?.targetMonths ?? 6;

  const expenses = await prisma.transaction.findMany({
    where: { entityId, kind: "EXPENSE", deletedAt: null },
    select: { date: true, madEquivalentCents: true },
  });

  const monthKeys = new Set<string>();
  let totalCents = 0;
  for (const tx of expenses) {
    const d = tx.date;
    monthKeys.add(`${d.getUTCFullYear()}-${d.getUTCMonth()}`);
    totalCents += tx.madEquivalentCents ?? 0;
  }

  const monthsOfHistory = monthKeys.size;
  if (monthsOfHistory < EMERGENCY_FUND_MIN_MONTHS_OF_HISTORY) {
    return {
      status: "insufficient_history",
      monthsOfHistory,
      requiredMonths: EMERGENCY_FUND_MIN_MONTHS_OF_HISTORY,
    };
  }

  const monthlyAverageCents = Math.round(totalCents / monthsOfHistory);
  return {
    status: "ok",
    monthlyAverageCents,
    targetCents: monthlyAverageCents * targetMonths,
    monthsOfHistory,
  };
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
