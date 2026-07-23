import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ImageUploader } from "@/components/admin/image-uploader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminCategory, getAdminProductsByCategory } from "@/lib/data/adminMenu";

import { updateCategory, uploadCategoryImage } from "../actions";
import { CategoryForm } from "../category-form";
import { ProductList } from "./product-list";

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
        <CardContent className="flex flex-col gap-4">
          <ImageUploader currentUrl={category.imageUrl} uploadAction={uploadCategoryImage.bind(null, categoryId)} />
          <CategoryForm
            initial={{
              layout: category.layout,
              nameTr: category.name.tr,
              nameEn: category.name.en,
              isActive: category.isActive,
              station: category.station ?? "",
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

      <ProductList categoryId={categoryId} products={products} />
    </div>
  );
}
