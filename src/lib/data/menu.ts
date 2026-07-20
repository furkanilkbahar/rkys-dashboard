import "server-only";

import { createClient } from "@/lib/supabase/server";

export type MenuVariant = {
  id: string;
  name: string;
  priceMinor: number;
  isOrderable: boolean;
};

export type MenuExtra = {
  id: string;
  name: string;
  priceMinor: number;
  isOrderable: boolean;
};

export type MenuProduct = {
  id: string;
  name: string;
  priceMinor: number;
  isOrderable: boolean;
  imageUrl: string | null;
  variants: MenuVariant[];
  extras: MenuExtra[];
};

export type MenuCategory = {
  id: string;
  name: string;
  layout: "grid" | "list" | "showcase";
  imageUrl: string | null;
  products: MenuProduct[];
};

function effectiveKey(productId: string, variantId: string | null): string {
  return `${productId}:${variantId ?? ""}`;
}

/**
 * Etkin menüyü (override→varyant→ürün fallback zinciri, effective_menu_items
 * view'ı üzerinden) çeviriyle birleştirip nested Kategori→Ürün yapısına
 * dönüştürür. tenant_id her sorguda ayrıca filtrelenir (RLS olsa bile
 * savunma katmanı — RULES #2), branch_id ile şube-özel fiyat/stok gelir.
 */
export async function getEffectiveMenu(
  tenantId: string,
  branchId: string,
  locale: string,
): Promise<MenuCategory[]> {
  const supabase = await createClient();

  const { data: defaultLocaleRow } = await supabase
    .from("tenant_locales")
    .select("locale")
    .eq("tenant_id", tenantId)
    .eq("is_default", true)
    .maybeSingle();
  const fallbackLocale = defaultLocaleRow?.locale ?? "tr";
  const locales = locale === fallbackLocale ? [locale] : [locale, fallbackLocale];

  const [categoriesRes, productsRes, effectiveRes, translationsRes] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, layout, display_order, image_url")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("products")
      .select(
        `id, category_id, base_price_minor, display_order, image_url,
         product_variants(id, price_minor, display_order, is_active),
         product_extras(id, price_minor, display_order, is_active, is_sold_out, stock_quantity)`,
      )
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("effective_menu_items")
      .select("product_id, variant_id, effective_price_minor, is_orderable")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId),
    supabase
      .from("content_translations")
      .select("entity_type, entity_id, locale, value")
      .eq("tenant_id", tenantId)
      .eq("field", "name")
      .in("locale", locales),
  ]);

  const effectiveMap = new Map<string, { priceMinor: number; isOrderable: boolean }>();
  for (const row of effectiveRes.data ?? []) {
    if (!row.product_id) continue; // view sütunları generic olarak nullable üretilir; ürünsüz satır olmaz
    effectiveMap.set(effectiveKey(row.product_id, row.variant_id), {
      priceMinor: row.effective_price_minor ?? 0,
      isOrderable: row.is_orderable ?? false,
    });
  }

  // Önce fallback locale, sonra istenen locale yazılır — istenen locale'de
  // çeviri varsa üzerine yazıp kazanır; yoksa fallback değeri kalır.
  const nameMap = new Map<string, string>();
  for (const wantedLocale of [fallbackLocale, locale]) {
    for (const row of translationsRes.data ?? []) {
      if (row.locale === wantedLocale) {
        nameMap.set(`${row.entity_type}:${row.entity_id}`, row.value);
      }
    }
  }

  const productsByCategory = new Map<string, MenuProduct[]>();
  for (const product of productsRes.data ?? []) {
    const productEffective = effectiveMap.get(effectiveKey(product.id, null));

    const variants: MenuVariant[] = (product.product_variants ?? [])
      .filter((v) => v.is_active)
      .sort((a, b) => a.display_order - b.display_order)
      .map((v) => {
        const effective = effectiveMap.get(effectiveKey(product.id, v.id));
        return {
          id: v.id,
          name: nameMap.get(`product_variant:${v.id}`) ?? "",
          priceMinor: effective?.priceMinor ?? v.price_minor,
          isOrderable: effective?.isOrderable ?? false,
        };
      });

    const extras: MenuExtra[] = (product.product_extras ?? [])
      .filter((e) => e.is_active)
      .sort((a, b) => a.display_order - b.display_order)
      .map((e) => ({
        id: e.id,
        name: nameMap.get(`product_extra:${e.id}`) ?? "",
        priceMinor: e.price_minor,
        isOrderable: !e.is_sold_out && (e.stock_quantity === null || e.stock_quantity > 0),
      }));

    const menuProduct: MenuProduct = {
      id: product.id,
      name: nameMap.get(`product:${product.id}`) ?? "",
      priceMinor: variants.length > 0 ? variants[0].priceMinor : (productEffective?.priceMinor ?? product.base_price_minor),
      isOrderable:
        variants.length > 0 ? variants.some((v) => v.isOrderable) : (productEffective?.isOrderable ?? false),
      imageUrl: product.image_url,
      variants,
      extras,
    };

    const list = productsByCategory.get(product.category_id) ?? [];
    list.push(menuProduct);
    productsByCategory.set(product.category_id, list);
  }

  return (categoriesRes.data ?? []).map((category) => ({
    id: category.id,
    name: nameMap.get(`menu_category:${category.id}`) ?? "",
    layout: category.layout as MenuCategory["layout"],
    imageUrl: category.image_url,
    products: productsByCategory.get(category.id) ?? [],
  }));
}
