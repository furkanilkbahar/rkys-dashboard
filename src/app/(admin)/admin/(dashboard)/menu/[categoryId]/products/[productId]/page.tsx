import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ImageUploader } from "@/components/admin/image-uploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminCategory, getAdminProduct, getProductGallery } from "@/lib/data/adminMenu";
import { isEnabled } from "@/lib/modules/isEnabled";

import {
  createExtra,
  createVariant,
  reorderExtras,
  reorderVariants,
  selectProductImageFromGallery,
  updateExtra,
  updateProduct,
  updateVariant,
  uploadProductImage,
} from "../../../actions";
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
  const gallery = await getProductGallery(actor.tenantId);
  const recipesEnabled = await isEnabled(actor.tenantId, "recipes");

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/admin/menu/${categoryId}`} className="text-sm text-muted-foreground hover:underline">
        ← {category.name.tr || category.name.en}
      </Link>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>{t("product.editTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ImageUploader
            currentUrl={product.imageUrl}
            uploadAction={uploadProductImage.bind(null, productId)}
            gallery={gallery}
            onSelectFromGallery={selectProductImageFromGallery.bind(null, productId)}
          />
          <ProductForm
            categoryId={categoryId}
            productId={productId}
            recipesEnabled={recipesEnabled}
            initial={{
              basePriceMinor: product.basePriceMinor,
              stockQuantity: product.stockQuantity,
              trackMode: product.trackMode,
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
          reorderAction={reorderVariants.bind(null, productId)}
        />
        <VariantExtraEditor
          kind="extra"
          productId={productId}
          items={extras}
          createAction={createExtra}
          updateAction={updateExtra}
          reorderAction={reorderExtras.bind(null, productId)}
        />
      </div>
    </div>
  );
}
