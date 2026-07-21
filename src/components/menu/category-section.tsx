import type { MenuCategory } from "@/lib/data/menu";
import { cn } from "@/lib/utils/cn";

import { ProductCard } from "./product-card";

const LAYOUT_CLASSES: Record<MenuCategory["layout"], string> = {
  grid: "grid grid-cols-2 gap-3 sm:grid-cols-3",
  list: "flex flex-col gap-3",
  showcase: "flex flex-col gap-4",
};

export function CategorySection({ category, currency }: { category: MenuCategory; currency: string }) {
  if (category.products.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{category.name}</h2>
      <div className={cn(LAYOUT_CLASSES[category.layout])}>
        {category.products.map((product) => (
          <ProductCard key={product.id} product={product} currency={currency} />
        ))}
      </div>
    </section>
  );
}
