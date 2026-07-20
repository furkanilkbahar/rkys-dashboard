"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";

import { SortableList } from "@/components/admin/sortable-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminProduct } from "@/lib/data/adminMenu";

import { reorderProducts } from "../actions";

export function ProductList({ categoryId, products }: { categoryId: string; products: AdminProduct[] }) {
  const t = useTranslations("admin.menu");

  return (
    <SortableList
      items={products}
      onReorder={(ids) => reorderProducts(categoryId, ids)}
      className="flex flex-col gap-2"
      renderItem={(product, dragHandle: ReactNode) => (
        <Card className="transition-colors hover:border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {dragHandle}
              <Link
                href={`/admin/menu/${categoryId}/products/${product.id}`}
                className="flex flex-1 items-center justify-between"
              >
                <span>{product.name.tr || product.name.en}</span>
                <Badge variant={product.isActive ? "secondary" : "destructive"}>
                  {product.isActive ? t("category.active") : t("category.inactive")}
                </Badge>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-10 text-sm text-muted-foreground">
            {(product.basePriceMinor / 100).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
            {product.isSoldOut && ` · ${t("product.soldOut")}`}
          </CardContent>
        </Card>
      )}
    />
  );
}
