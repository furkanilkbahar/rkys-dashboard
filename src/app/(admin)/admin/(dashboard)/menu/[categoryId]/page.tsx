import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminCategory, getAdminProductsByCategory } from "@/lib/data/adminMenu";

import { updateCategory } from "../actions";
import { CategoryForm } from "../category-form";

export default async function CategoryDetailPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await params;
  const actor = await requireAdminActor();
  const t = await getTranslations("admin.menu");

  const category = await getAdminCategory(actor.tenantId, categoryId);
  if (!category) {
    notFound();
  }

  const products = await getAdminProductsByCategory(actor.tenantId, categoryId);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/menu" className="text-sm text-muted-foreground hover:underline">
        ← {t("backToCategories")}
      </Link>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{t("category.editTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryForm
            initial={{
              layout: category.layout,
              nameTr: category.name.tr,
              nameEn: category.name.en,
              isActive: category.isActive,
            }}
            action={updateCategory.bind(null, categoryId)}
            redirectTo={`/admin/menu/${categoryId}`}
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <Button nativeButton={false} render={<Link href={`/admin/menu/${categoryId}/products/new`} />}>
          {t("product.addProduct")}
        </Button>
      </div>

      {products.length === 0 && <p className="text-sm text-muted-foreground">{t("product.empty")}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Link key={product.id} href={`/admin/menu/${categoryId}/products/${product.id}`}>
            <Card className="transition-colors hover:border-primary">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{product.name.tr || product.name.en}</span>
                  <Badge variant={product.isActive ? "secondary" : "destructive"}>
                    {product.isActive ? t("category.active") : t("category.inactive")}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {(product.basePriceMinor / 100).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                {product.isSoldOut && ` · ${t("product.soldOut")}`}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
