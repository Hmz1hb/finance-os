import type { ContextMode, FinancialEntity, FinancialEntityType } from "@prisma/client";
import { prisma } from "@/lib/server/db";

export const UK_LTD_ENTITY_ID = "uk_ltd";
export const MOROCCO_PERSONAL_ENTITY_ID = "morocco_personal";

export async function ensureDefaultEntities() {
  const [ukLtd, moroccoPersonal] = await Promise.all([
    prisma.financialEntity.upsert({
      where: { id: UK_LTD_ENTITY_ID },
      create: {
        id: UK_LTD_ENTITY_ID,
        slug: "uk-ltd",
        name: "UK LTD",
        type: "UK_LTD",
        baseCurrency: "GBP",
        country: "GB",
        taxResidence: "UK",
        sortOrder: 1,
        settings: { vatRegistered: false, vatThresholdCents: 9000000, reportingDefault: "UK_TAX_YEAR" },
      },
      update: {},
    }),
    prisma.financialEntity.upsert({
      where: { id: MOROCCO_PERSONAL_ENTITY_ID },
      create: {
        id: MOROCCO_PERSONAL_ENTITY_ID,
        slug: "morocco-personal",
        name: "Morocco Personal",
        type: "MOROCCO_PERSONAL",
        baseCurrency: "MAD",
        country: "MA",
        taxResidence: "MOROCCO",
        sortOrder: 2,
        settings: { includesAutoEntrepreneur: true },
      },
      update: {},
    }),
  ]);
  return { ukLtd, moroccoPersonal };
}

export async function listEntities() {
  await ensureDefaultEntities();
  return prisma.financialEntity.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export function contextForEntityType(type: FinancialEntityType): ContextMode {
  return type === "UK_LTD" ? "BUSINESS" : "PERSONAL";
}

export function entityIdFromSearch(value?: string | null) {
  if (!value || value === "combined") return undefined;
  return value;
}

export function entityLabel(entity?: Pick<FinancialEntity, "name"> | null) {
  return entity?.name ?? "Combined";
}
