import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminCategories } from "@/lib/data/adminMenu";

export default async function AdminMenuPage() {
  const actor = await requireAdminActor();
  const t = await getTranslations("admin.menu");
  const categories = await getAdminCategories(actor.tenantId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <Button nativeButton={false} render={<Link href="/admin/menu/new" />}>
          {t("addCategory")}
        </Button>
      </div>

      {categories.length === 0 && <p className="text-sm text-muted-foreground">{t("categoriesEmpty")}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Link key={category.id} href={`/admin/menu/${category.id}`}>
            <Card className="transition-colors hover:border-primary">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{category.name.tr || category.name.en}</span>
                  <Badge variant={category.isActive ? "secondary" : "destructive"}>
                    {category.isActive ? t("category.active") : t("category.inactive")}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {t("category.productCount", { count: category.productCount })}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
