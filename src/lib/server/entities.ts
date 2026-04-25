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

const KNOWN_ENTITY_IDS = new Set([UK_LTD_ENTITY_ID, MOROCCO_PERSONAL_ENTITY_ID]);

export type EntityIdSearchResult =
  | { kind: "combined" }
  | { kind: "valid"; entityId: string }
  | { kind: "invalid"; raw: string };

export function entityIdFromSearch(value?: string | null) {
  if (!value || value === "combined") return undefined;
  if (KNOWN_ENTITY_IDS.has(value)) return value;
  return undefined;
}

export function resolveEntityFromSearch(value?: string | null): EntityIdSearchResult {
  if (!value || value === "combined") return { kind: "combined" };
  if (KNOWN_ENTITY_IDS.has(value)) return { kind: "valid", entityId: value };
  return { kind: "invalid", raw: value };
}

export function entityLabel(entity?: Pick<FinancialEntity, "name"> | null) {
  return entity?.name ?? "Combined";
}
