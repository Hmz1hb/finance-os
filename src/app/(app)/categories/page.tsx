import { CategoryForm } from "@/components/app/category-form";
import { CategoryRow } from "@/components/app/category-row";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({ where: { deletedAt: null }, orderBy: [{ context: "asc" }, { type: "asc" }, { name: "asc" }] }).catch(() => []);
  return (
    <>
      <PageHeader title="Categories" description="Customizable income and expense taxonomy across personal, business, and shared finances." badge="Taxonomy" />
      <section className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
        <Card>
          <CardHeader><CardTitle>New category</CardTitle></CardHeader>
          <CategoryForm />
        </Card>
        <Card>
          <CardHeader><CardTitle>{categories.length} categories</CardTitle></CardHeader>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => (
              <CategoryRow key={category.id} category={category} />
            ))}
          </div>
        </Card>
      </section>
    </>
  );
}
