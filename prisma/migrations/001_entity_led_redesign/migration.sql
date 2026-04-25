CREATE TYPE "FinancialEntityType" AS ENUM ('UK_LTD', 'MOROCCO_PERSONAL', 'MOROCCO_AUTO_ENTREPRENEUR');
CREATE TYPE "RecurringRuleType" AS ENUM ('EXPECTED_INCOME', 'EXPECTED_EXPENSE', 'RECEIVABLE', 'SUBSCRIPTION', 'OWNER_PAY');
CREATE TYPE "RecurringCadence" AS ENUM ('INTERVAL_DAYS', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY_DAY', 'SEMI_MONTHLY', 'QUARTERLY', 'YEARLY');
CREATE TYPE "ExpectedIncomeStatus" AS ENUM ('FORECAST', 'DUE', 'SETTLED', 'SKIPPED', 'CANCELLED');
CREATE TYPE "ReceivableKind" AS ENUM ('CLIENT_INVOICE', 'PERSONAL_IOU', 'BUSINESS_RECEIVABLE', 'OTHER');
CREATE TYPE "ReceivableStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'OVERDUE', 'DISPUTED', 'CANCELLED');
CREATE TYPE "TaxProfileType" AS ENUM ('UK_LTD_CORPORATION_TAX', 'MOROCCO_AUTO_ENTREPRENEUR');
CREATE TYPE "TaxReserveStatus" AS ENUM ('SUGGESTED', 'RESERVED', 'PAID', 'WAIVED');
CREATE TYPE "OwnerCompensationType" AS ENUM ('SALARY', 'DIVIDEND', 'DIRECTOR_LOAN', 'REIMBURSEMENT', 'DRAWINGS', 'OTHER');

CREATE TABLE "FinancialEntity" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "FinancialEntityType" NOT NULL,
  "baseCurrency" "Currency" NOT NULL,
  "country" TEXT NOT NULL,
  "taxResidence" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "settings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialEntity_pkey" PRIMARY KEY ("id")
);

INSERT INTO "FinancialEntity" ("id", "slug", "name", "type", "baseCurrency", "country", "taxResidence", "sortOrder", "settings", "updatedAt")
VALUES
  ('uk_ltd', 'uk-ltd', 'UK LTD', 'UK_LTD', 'GBP', 'GB', 'UK', 1, '{"vatRegistered":false,"vatThresholdCents":9000000,"reportingDefault":"UK_TAX_YEAR"}'::jsonb, CURRENT_TIMESTAMP),
  ('morocco_personal', 'morocco-personal', 'Morocco Personal', 'MOROCCO_PERSONAL', 'MAD', 'MA', 'MOROCCO', 2, '{"includesAutoEntrepreneur":true}'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "Transaction" ADD COLUMN "entityId" TEXT;
ALTER TABLE "RecurringTemplate" ADD COLUMN "entityId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "entityId" TEXT;
ALTER TABLE "Loan" ADD COLUMN "entityId" TEXT;
ALTER TABLE "Goal" ADD COLUMN "entityId" TEXT;

UPDATE "Transaction" SET "entityId" = CASE
  WHEN "context" = 'BUSINESS' THEN 'uk_ltd'
  ELSE 'morocco_personal'
END
WHERE "entityId" IS NULL;

UPDATE "RecurringTemplate" SET "entityId" = CASE
  WHEN "context" = 'BUSINESS' THEN 'uk_ltd'
  ELSE 'morocco_personal'
END
WHERE "entityId" IS NULL;

UPDATE "Subscription" SET "entityId" = CASE
  WHEN "context" = 'BUSINESS' THEN 'uk_ltd'
  ELSE 'morocco_personal'
END
WHERE "entityId" IS NULL;

UPDATE "Loan" SET "entityId" = 'morocco_personal' WHERE "entityId" IS NULL;
UPDATE "Goal" SET "entityId" = 'morocco_personal' WHERE "entityId" IS NULL;

CREATE TABLE "RecurringRule" (
  "id" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "ruleType" "RecurringRuleType" NOT NULL,
  "cadence" "RecurringCadence" NOT NULL,
  "intervalDays" INTEGER,
  "dayOfMonth" INTEGER,
  "secondDayOfMonth" INTEGER,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "nextDueDate" TIMESTAMP(3) NOT NULL,
  "autoCreate" BOOLEAN NOT NULL DEFAULT false,
  "amountCents" INTEGER NOT NULL,
  "currency" "Currency" NOT NULL,
  "counterparty" TEXT,
  "categoryId" TEXT,
  "notes" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecurringRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExpectedIncome" (
  "id" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "recurringRuleId" TEXT,
  "receivableId" TEXT,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" "Currency" NOT NULL,
  "exchangeRateSnapshot" DECIMAL(18,8) NOT NULL,
  "madEquivalentCents" INTEGER NOT NULL,
  "counterparty" TEXT,
  "description" TEXT NOT NULL,
  "status" "ExpectedIncomeStatus" NOT NULL DEFAULT 'FORECAST',
  "transactionId" TEXT,
  "settledAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExpectedIncome_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Receivable" (
  "id" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "kind" "ReceivableKind" NOT NULL,
  "status" "ReceivableStatus" NOT NULL DEFAULT 'OPEN',
  "counterparty" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3),
  "amountCents" INTEGER NOT NULL,
  "currency" "Currency" NOT NULL,
  "exchangeRateSnapshot" DECIMAL(18,8) NOT NULL,
  "madEquivalentCents" INTEGER NOT NULL,
  "paidAmountCents" INTEGER NOT NULL DEFAULT 0,
  "source" TEXT,
  "clientId" TEXT,
  "invoiceId" TEXT,
  "notes" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Receivable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReceivablePayment" (
  "id" TEXT NOT NULL,
  "receivableId" TEXT NOT NULL,
  "transactionId" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" "Currency" NOT NULL,
  "exchangeRateSnapshot" DECIMAL(18,8) NOT NULL,
  "madEquivalentCents" INTEGER NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReceivablePayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaxProfile" (
  "id" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "type" "TaxProfileType" NOT NULL,
  "name" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "rules" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaxProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaxReserve" (
  "id" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "taxProfileId" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "taxableBaseCents" INTEGER NOT NULL,
  "estimatedTaxCents" INTEGER NOT NULL,
  "reserveCents" INTEGER NOT NULL,
  "currency" "Currency" NOT NULL,
  "assumptions" JSONB NOT NULL,
  "status" "TaxReserveStatus" NOT NULL DEFAULT 'SUGGESTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaxReserve_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OwnerCompensation" (
  "id" TEXT NOT NULL,
  "fromEntityId" TEXT NOT NULL,
  "toEntityId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" "Currency" NOT NULL,
  "exchangeRateSnapshot" DECIMAL(18,8) NOT NULL,
  "madEquivalentCents" INTEGER NOT NULL,
  "paymentType" "OwnerCompensationType" NOT NULL,
  "taxTreatment" TEXT,
  "businessTransactionId" TEXT,
  "personalTransactionId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OwnerCompensation_pkey" PRIMARY KEY ("id")
);

INSERT INTO "TaxProfile" ("id", "entityId", "type", "name", "effectiveFrom", "rules", "updatedAt")
VALUES
  ('uk_ltd_ct_2026', 'uk_ltd', 'UK_LTD_CORPORATION_TAX', 'UK LTD corporation tax estimate', '2026-04-06T00:00:00.000Z', '{"smallProfitsRate":0.19,"mainRate":0.25,"lowerLimitCents":5000000,"upperLimitCents":25000000,"marginalReliefFraction":"3/200","vatThresholdCents":9000000,"vatRegistered":false}'::jsonb, CURRENT_TIMESTAMP),
  ('ma_ae_2026', 'morocco_personal', 'MOROCCO_AUTO_ENTREPRENEUR', 'Morocco auto-entrepreneur estimate', '2026-01-01T00:00:00.000Z', '{"commerceRate":0.005,"serviceRate":0.01,"commerceCeilingCents":50000000,"serviceCeilingCents":20000000,"singleClientThresholdCents":8000000,"singleClientExcessRate":0.30,"vatExempt":true,"declarationCadence":"QUARTERLY"}'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

CREATE UNIQUE INDEX "FinancialEntity_slug_key" ON "FinancialEntity"("slug");
CREATE INDEX "FinancialEntity_type_idx" ON "FinancialEntity"("type");
CREATE INDEX "FinancialEntity_isActive_sortOrder_idx" ON "FinancialEntity"("isActive", "sortOrder");
CREATE INDEX "Transaction_entityId_date_idx" ON "Transaction"("entityId", "date");
CREATE INDEX "RecurringTemplate_entityId_nextDueDate_idx" ON "RecurringTemplate"("entityId", "nextDueDate");
CREATE INDEX "RecurringRule_entityId_ruleType_idx" ON "RecurringRule"("entityId", "ruleType");
CREATE INDEX "RecurringRule_nextDueDate_idx" ON "RecurringRule"("nextDueDate");
CREATE INDEX "RecurringRule_deletedAt_idx" ON "RecurringRule"("deletedAt");
CREATE INDEX "ExpectedIncome_entityId_dueDate_idx" ON "ExpectedIncome"("entityId", "dueDate");
CREATE INDEX "ExpectedIncome_status_dueDate_idx" ON "ExpectedIncome"("status", "dueDate");
CREATE INDEX "ExpectedIncome_recurringRuleId_idx" ON "ExpectedIncome"("recurringRuleId");
CREATE INDEX "Subscription_entityId_nextBillingDate_idx" ON "Subscription"("entityId", "nextBillingDate");
CREATE INDEX "Loan_entityId_kind_idx" ON "Loan"("entityId", "kind");
CREATE INDEX "Goal_entityId_idx" ON "Goal"("entityId");
CREATE INDEX "Receivable_entityId_status_idx" ON "Receivable"("entityId", "status");
CREATE INDEX "Receivable_dueDate_idx" ON "Receivable"("dueDate");
CREATE INDEX "Receivable_counterparty_idx" ON "Receivable"("counterparty");
CREATE INDEX "Receivable_deletedAt_idx" ON "Receivable"("deletedAt");
CREATE INDEX "ReceivablePayment_receivableId_date_idx" ON "ReceivablePayment"("receivableId", "date");
CREATE INDEX "ReceivablePayment_transactionId_idx" ON "ReceivablePayment"("transactionId");
CREATE INDEX "TaxProfile_entityId_type_isActive_idx" ON "TaxProfile"("entityId", "type", "isActive");
CREATE INDEX "TaxProfile_effectiveFrom_effectiveTo_idx" ON "TaxProfile"("effectiveFrom", "effectiveTo");
CREATE INDEX "TaxReserve_entityId_periodStart_periodEnd_idx" ON "TaxReserve"("entityId", "periodStart", "periodEnd");
CREATE INDEX "TaxReserve_status_idx" ON "TaxReserve"("status");
CREATE INDEX "OwnerCompensation_fromEntityId_date_idx" ON "OwnerCompensation"("fromEntityId", "date");
CREATE INDEX "OwnerCompensation_toEntityId_date_idx" ON "OwnerCompensation"("toEntityId", "date");
CREATE INDEX "OwnerCompensation_paymentType_idx" ON "OwnerCompensation"("paymentType");

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "FinancialEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecurringTemplate" ADD CONSTRAINT "RecurringTemplate_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "FinancialEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "FinancialEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExpectedIncome" ADD CONSTRAINT "ExpectedIncome_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "FinancialEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpectedIncome" ADD CONSTRAINT "ExpectedIncome_recurringRuleId_fkey" FOREIGN KEY ("recurringRuleId") REFERENCES "RecurringRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExpectedIncome" ADD CONSTRAINT "ExpectedIncome_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "Receivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExpectedIncome" ADD CONSTRAINT "ExpectedIncome_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "FinancialEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "FinancialEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "FinancialEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "FinancialEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReceivablePayment" ADD CONSTRAINT "ReceivablePayment_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "Receivable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceivablePayment" ADD CONSTRAINT "ReceivablePayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaxProfile" ADD CONSTRAINT "TaxProfile_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "FinancialEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxReserve" ADD CONSTRAINT "TaxReserve_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "FinancialEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxReserve" ADD CONSTRAINT "TaxReserve_taxProfileId_fkey" FOREIGN KEY ("taxProfileId") REFERENCES "TaxProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OwnerCompensation" ADD CONSTRAINT "OwnerCompensation_fromEntityId_fkey" FOREIGN KEY ("fromEntityId") REFERENCES "FinancialEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OwnerCompensation" ADD CONSTRAINT "OwnerCompensation_toEntityId_fkey" FOREIGN KEY ("toEntityId") REFERENCES "FinancialEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
