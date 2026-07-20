import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminCategory, getAdminProduct } from "@/lib/data/adminMenu";

import { createExtra, createVariant, updateExtra, updateProduct, updateVariant } from "../../../actions";
import { ProductForm } from "../product-form";
import { VariantExtraEditor } from "./variant-extra-editor";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ categoryId: string; productId: string }>;
}) {
  const { categoryId, productId } = await params;
  const actor = await requireAdminActor();
  const t = await getTranslations("admin.menu");

  const category = await getAdminCategory(actor.tenantId, categoryId);
  const result = await getAdminProduct(actor.tenantId, productId);
  if (!category || !result || result.product.categoryId !== categoryId) {
    notFound();
  }

  const { product, variants, extras } = result;

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/admin/menu/${categoryId}`} className="text-sm text-muted-foreground hover:underline">
        ← {category.name.tr || category.name.en}
      </Link>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>{t("product.editTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm
            categoryId={categoryId}
            initial={{
              basePriceMinor: product.basePriceMinor,
              stockQuantity: product.stockQuantity,
              isSoldOut: product.isSoldOut,
              isActive: product.isActive,
              nameTr: product.name.tr,
              nameEn: product.name.en,
              descriptionTr: product.description.tr,
              descriptionEn: product.description.en,
            }}
            action={updateProduct.bind(null, productId)}
            redirectTo={`/admin/menu/${categoryId}/products/${productId}`}
          />
        </CardContent>
      </Card>

      <div className="grid max-w-3xl grid-cols-1 gap-6 lg:grid-cols-2">
        <VariantExtraEditor
          kind="variant"
          productId={productId}
          items={variants}
          createAction={createVariant}
          updateAction={updateVariant}
        />
        <VariantExtraEditor
          kind="extra"
          productId={productId}
          items={extras}
          createAction={createExtra}
          updateAction={updateExtra}
        />
      </div>
    </div>
  );
}
