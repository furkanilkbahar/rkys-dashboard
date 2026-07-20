import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminCategory } from "@/lib/data/adminMenu";

import { createProduct } from "../../../actions";
import { ProductForm } from "../product-form";

export default async function NewProductPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await params;
  const actor = await requireAdminActor();
  const t = await getTranslations("admin.menu");

  const category = await getAdminCategory(actor.tenantId, categoryId);
  if (!category) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/admin/menu/${categoryId}`} className="text-sm text-muted-foreground hover:underline">
        ← {category.name.tr || category.name.en}
      </Link>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>{t("product.createTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm categoryId={categoryId} action={createProduct} redirectTo={`/admin/menu/${categoryId}`} />
        </CardContent>
      </Card>
    </div>
  );
}
