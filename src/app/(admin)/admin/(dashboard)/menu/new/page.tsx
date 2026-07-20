import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminActor } from "@/lib/auth/adminGuard";

import { createCategory } from "../actions";
import { CategoryForm } from "../category-form";

export default async function NewCategoryPage() {
  await requireAdminActor();
  const t = await getTranslations("admin.menu");

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/menu" className="text-sm text-muted-foreground hover:underline">
        ← {t("backToCategories")}
      </Link>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{t("category.createTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryForm action={createCategory} redirectTo="/admin/menu" />
        </CardContent>
      </Card>
    </div>
  );
}
