import { PageHeader } from "@/components/app/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({ where: { deletedAt: null }, orderBy: [{ context: "asc" }, { type: "asc" }, { name: "asc" }] }).catch(() => []);
  return (
    <>
      <PageHeader title="Categories" description="Customizable income and expense taxonomy across personal, business, and shared finances." badge="Taxonomy" />
      <Card>
        <CardHeader><CardTitle>{categories.length} categories</CardTitle></CardHeader>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => <div key={category.id} className="rounded-md bg-surface-inset p-3"><p className="text-sm font-medium">{category.name}</p><p className="text-xs text-muted-ledger">{category.context} · {category.type}</p></div>)}
        </div>
      </Card>
    </>
  );
}
