"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";

import { SortableList } from "@/components/admin/sortable-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminCategory } from "@/lib/data/adminMenu";

import { reorderMenuCategories } from "./actions";

export function CategoryList({ categories }: { categories: AdminCategory[] }) {
  const t = useTranslations("admin.menu");

  return (
    <SortableList
      items={categories}
      onReorder={reorderMenuCategories}
      className="flex flex-col gap-2"
      renderItem={(category, dragHandle: ReactNode) => (
        <Card className="transition-colors hover:border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {dragHandle}
              <Link href={`/admin/menu/${category.id}`} className="flex flex-1 items-center justify-between">
                <span>{category.name.tr || category.name.en}</span>
                <Badge variant={category.isActive ? "secondary" : "destructive"}>
                  {category.isActive ? t("category.active") : t("category.inactive")}
                </Badge>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-10 text-sm text-muted-foreground">
            {t("category.productCount", { count: category.productCount })}
          </CardContent>
        </Card>
      )}
    />
  );
}
