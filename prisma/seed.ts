import { PrismaClient, ContextMode, Currency, GoalCategory, TransactionType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/finance_os?schema=public",
  }),
});

const categories = [
  ["Business Revenue", "business-revenue", TransactionType.INCOME, ContextMode.BUSINESS, "#27AE60", "BriefcaseBusiness"],
  ["AzloTV / Filmsa", "azlotv-filmsa", TransactionType.INCOME, ContextMode.BUSINESS, "#27AE60", "Tv"],
  ["PROPD Client Projects", "propd-client-projects", TransactionType.INCOME, ContextMode.BUSINESS, "#4A90D9", "Code2"],
  ["Fiverr", "fiverr", TransactionType.INCOME, ContextMode.BUSINESS, "#27AE60", "BadgeDollarSign"],
  ["WebSolution.ma", "websolution-ma", TransactionType.INCOME, ContextMode.BUSINESS, "#4A90D9", "Globe2"],
  ["Infrastructure", "infrastructure", TransactionType.EXPENSE, ContextMode.BUSINESS, "#8E44AD", "Server"],
  ["SaaS & Tools", "saas-tools", TransactionType.EXPENSE, ContextMode.BUSINESS, "#8E44AD", "Wrench"],
  ["Payment Processing", "payment-processing", TransactionType.EXPENSE, ContextMode.BUSINESS, "#E74C3C", "CreditCard"],
  ["Marketing", "marketing", TransactionType.EXPENSE, ContextMode.BUSINESS, "#F39C12", "Megaphone"],
  ["Professional Services", "professional-services", TransactionType.EXPENSE, ContextMode.BUSINESS, "#4A90D9", "Scale"],
  ["Office & Equipment", "office-equipment", TransactionType.EXPENSE, ContextMode.BUSINESS, "#8E44AD", "Monitor"],
  ["Travel", "business-travel", TransactionType.EXPENSE, ContextMode.BUSINESS, "#F39C12", "Plane"],
  ["Personal Income", "personal-income", TransactionType.INCOME, ContextMode.PERSONAL, "#27AE60", "Wallet"],
  ["Salary From Business", "salary-from-business", TransactionType.INCOME, ContextMode.PERSONAL, "#27AE60", "Landmark"],
  ["Rent / Mortgage", "rent-mortgage", TransactionType.EXPENSE, ContextMode.PERSONAL, "#E74C3C", "Home"],
  ["Utilities", "utilities", TransactionType.EXPENSE, ContextMode.PERSONAL, "#F39C12", "Zap"],
  ["Internet & Phone", "internet-phone", TransactionType.EXPENSE, ContextMode.PERSONAL, "#4A90D9", "Wifi"],
  ["Groceries", "groceries", TransactionType.EXPENSE, ContextMode.PERSONAL, "#27AE60", "ShoppingBasket"],
  ["Dining Out", "dining-out", TransactionType.EXPENSE, ContextMode.PERSONAL, "#F39C12", "Utensils"],
  ["Coffee & Snacks", "coffee-snacks", TransactionType.EXPENSE, ContextMode.PERSONAL, "#F39C12", "Coffee"],
  ["Car Fuel", "car-fuel", TransactionType.EXPENSE, ContextMode.PERSONAL, "#E74C3C", "Car"],
  ["Motorcycle Fuel", "motorcycle-fuel", TransactionType.EXPENSE, ContextMode.PERSONAL, "#E74C3C", "Bike"],
  ["Motorcycle Maintenance", "motorcycle-maintenance", TransactionType.EXPENSE, ContextMode.PERSONAL, "#8E44AD", "Cog"],
  ["Car Maintenance", "car-maintenance", TransactionType.EXPENSE, ContextMode.PERSONAL, "#8E44AD", "Settings"],
  ["Subscriptions", "subscriptions", TransactionType.EXPENSE, ContextMode.BOTH, "#8E44AD", "Repeat"],
  ["Health", "health", TransactionType.EXPENSE, ContextMode.PERSONAL, "#E74C3C", "HeartPulse"],
  ["Lifestyle", "lifestyle", TransactionType.EXPENSE, ContextMode.PERSONAL, "#F39C12", "Sparkles"],
  ["Education", "education", TransactionType.EXPENSE, ContextMode.PERSONAL, "#4A90D9", "GraduationCap"],
  ["Giving", "giving", TransactionType.EXPENSE, ContextMode.PERSONAL, "#27AE60", "HandHeart"],
  ["Debt Payment", "debt-payment", TransactionType.EXPENSE, ContextMode.PERSONAL, "#E74C3C", "ReceiptText"],
] as const;

const goals = [
  ["Emergency Fund", 12000000, Currency.MAD, GoalCategory.NEEDS, 1],
  ["Portugal D7 Visa", 10000000, Currency.MAD, GoalCategory.NEEDS, 1],
  ["Motorcycle Upgrade", 6000000, Currency.MAD, GoalCategory.WANTS, 3],
  ["Office Setup", 3500000, Currency.MAD, GoalCategory.BUSINESS, 2],
  ["Investment Portfolio", 25000000, Currency.MAD, GoalCategory.INVESTMENT, 2],
  ["AzloTV Growth", 15000000, Currency.MAD, GoalCategory.BUSINESS, 2],
  ["PROPD UK Reserve", 1000000, Currency.GBP, GoalCategory.BUSINESS, 1],
  ["Travel Fund", 5000000, Currency.MAD, GoalCategory.WANTS, 4],
] as const;

async function main() {
  for (const [name, slug, type, context, color, icon] of categories) {
    await prisma.category.upsert({
      where: { slug },
      create: { name, slug, type, context, color, icon, isSystem: true },
      update: { name, type, context, color, icon, isSystem: true },
    });
  }

  for (const [name, targetAmountCents, currency, category, priority] of goals) {
    const existing = await prisma.goal.findFirst({ where: { name, deletedAt: null } });
    if (!existing) {
      await prisma.goal.create({
        data: { name, targetAmountCents, currency, category, priority },
      });
    }
  }

  await prisma.emergencyFundConfig.upsert({
    where: { id: "default" },
    create: { id: "default", targetMonths: 6, currentBalanceCents: 0, currency: Currency.MAD },
    update: { targetMonths: 6 },
  });

  await prisma.setting.upsert({
    where: { key: "preferences" },
    create: {
      key: "preferences",
      value: {
        baseCurrency: "MAD",
        defaultContext: "PERSONAL",
        theme: "dark",
        rateCacheHours: 24,
      },
    },
    update: {},
  });

  await prisma.payrollPerson.upsert({
    where: { id: "self" },
    create: {
      id: "self",
      name: "Owner",
      role: "Founder",
      paymentFrequency: "MONTHLY",
      rateCents: 0,
      currency: Currency.MAD,
      isSelf: true,
    },
    update: { isSelf: true },
  });

  const today = new Date();
  await prisma.exchangeRate.upsert({
    where: {
      date_baseCurrency_targetCurrency: {
        date: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())),
        baseCurrency: Currency.MAD,
        targetCurrency: Currency.MAD,
      },
    },
    create: {
      date: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())),
      baseCurrency: Currency.MAD,
      targetCurrency: Currency.MAD,
      rate: 1,
      source: "system",
    },
    update: { rate: 1, source: "system" },
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
