import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Button } from "@/components/ui/button";
import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminCategories } from "@/lib/data/adminMenu";

import { CategoryList } from "./category-list";

export default async function AdminMenuPage() {
  const actor = await requireAdminActor();
  const t = await getTranslations("admin.menu");
  const categories = await getAdminCategories(actor.tenantId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <AdminPageHeader title={t("title")} />
        <Button nativeButton={false} render={<Link href="/admin/menu/new" />}>
          {t("addCategory")}
        </Button>
      </div>

      {categories.length === 0 && <p className="text-sm text-muted-foreground">{t("categoriesEmpty")}</p>}

      <CategoryList categories={categories} />
    </div>
  );
}
