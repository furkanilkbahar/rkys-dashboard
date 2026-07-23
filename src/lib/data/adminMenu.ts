import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AdminTranslation = { tr: string; en: string };

export type AdminCategory = {
  id: string;
  layout: "grid" | "list" | "showcase";
  displayOrder: number;
  isActive: boolean;
  name: AdminTranslation;
  productCount: number;
  imageUrl: string | null;
  station: string | null;
};

export type AdminProduct = {
  id: string;
  categoryId: string;
  trackMode: "simple" | "recipe";
  basePriceMinor: number;
  stockQuantity: number | null;
  isSoldOut: boolean;
  displayOrder: number;
  isActive: boolean;
  name: AdminTranslation;
  description: AdminTranslation;
  imageUrl: string | null;
};

export type ProductGalleryImage = { id: string; url: string };

export type AdminVariant = {
  id: string;
  productId: string;
  priceMinor: number;
  stockQuantity: number | null;
  isSoldOut: boolean;
  displayOrder: number;
  isActive: boolean;
  name: AdminTranslation;
};

export type AdminExtra = {
  id: string;
  productId: string;
  priceMinor: number;
  stockQuantity: number | null;
  isSoldOut: boolean;
  displayOrder: number;
  isActive: boolean;
  name: AdminTranslation;
};

function translationMapKey(entityType: string, entityId: string, field: string): string {
  return `${entityType}:${entityId}:${field}`;
}

async function loadTranslations(tenantId: string, entityType: string, entityIds: string[]) {
  const supabase = await createClient();
  const map = new Map<string, string>();

  if (entityIds.length === 0) {
    return map;
  }

  const { data } = await supabase
    .from("content_translations")
    .select("entity_id, locale, field, value")
    .eq("tenant_id", tenantId)
    .eq("entity_type", entityType)
    .in("entity_id", entityIds);

  for (const row of data ?? []) {
    map.set(translationMapKey(entityType, row.entity_id, `${row.field}:${row.locale}`), row.value);
  }

  return map;
}

function readTranslation(
  map: Map<string, string>,
  entityType: string,
  entityId: string,
  field: "name" | "description",
): AdminTranslation {
  return {
    tr: map.get(translationMapKey(entityType, entityId, `${field}:tr`)) ?? "",
    en: map.get(translationMapKey(entityType, entityId, `${field}:en`)) ?? "",
  };
}

/**
 * Admin panelin kendi görünümü — misafirin gördüğü getEffectiveMenu'nün
 * aksine pasif (is_active=false) satırları da döner, çünkü personel
 * yayına almadan önce taslak düzenler.
 */
export async function getAdminCategories(tenantId: string): Promise<AdminCategory[]> {
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("menu_categories")
    .select("id, layout, display_order, is_active, image_url, station, products(count)")
    .eq("tenant_id", tenantId)
    .order("display_order");

  const categoryIds = (categories ?? []).map((c) => c.id);
  const nameMap = await loadTranslations(tenantId, "menu_category", categoryIds);

  return (categories ?? []).map((c) => ({
    id: c.id,
    layout: c.layout as AdminCategory["layout"],
    displayOrder: c.display_order,
    isActive: c.is_active,
    name: readTranslation(nameMap, "menu_category", c.id, "name"),
    productCount: c.products?.[0]?.count ?? 0,
    imageUrl: c.image_url,
    station: c.station,
  }));
}

export async function getAdminCategory(tenantId: string, categoryId: string): Promise<AdminCategory | null> {
  const supabase = await createClient();

  const { data: category } = await supabase
    .from("menu_categories")
    .select("id, layout, display_order, is_active, image_url, station")
    .eq("tenant_id", tenantId)
    .eq("id", categoryId)
    .maybeSingle();

  if (!category) {
    return null;
  }

  const nameMap = await loadTranslations(tenantId, "menu_category", [categoryId]);

  return {
    id: category.id,
    layout: category.layout as AdminCategory["layout"],
    displayOrder: category.display_order,
    isActive: category.is_active,
    name: readTranslation(nameMap, "menu_category", categoryId, "name"),
    productCount: 0,
    imageUrl: category.image_url,
    station: category.station,
  };
}

export async function getAdminProductsByCategory(tenantId: string, categoryId: string): Promise<AdminProduct[]> {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select(
      "id, category_id, track_mode, base_price_minor, stock_quantity, is_sold_out, display_order, is_active, image_url",
    )
    .eq("tenant_id", tenantId)
    .eq("category_id", categoryId)
    .order("display_order");

  const productIds = (products ?? []).map((p) => p.id);
  const translations = await loadTranslations(tenantId, "product", productIds);

  return (products ?? []).map((p) => ({
    id: p.id,
    categoryId: p.category_id,
    trackMode: p.track_mode as AdminProduct["trackMode"],
    basePriceMinor: p.base_price_minor,
    stockQuantity: p.stock_quantity,
    isSoldOut: p.is_sold_out,
    displayOrder: p.display_order,
    isActive: p.is_active,
    name: readTranslation(translations, "product", p.id, "name"),
    description: readTranslation(translations, "product", p.id, "description"),
    imageUrl: p.image_url,
  }));
}

export async function getAdminProduct(
  tenantId: string,
  productId: string,
): Promise<{ product: AdminProduct; variants: AdminVariant[]; extras: AdminExtra[] } | null> {
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select(
      "id, category_id, track_mode, base_price_minor, stock_quantity, is_sold_out, display_order, is_active, image_url",
    )
    .eq("tenant_id", tenantId)
    .eq("id", productId)
    .maybeSingle();

  if (!product) {
    return null;
  }

  const [variantsRes, extrasRes] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id, product_id, price_minor, stock_quantity, is_sold_out, display_order, is_active")
      .eq("tenant_id", tenantId)
      .eq("product_id", productId)
      .order("display_order"),
    supabase
      .from("product_extras")
      .select("id, product_id, price_minor, stock_quantity, is_sold_out, display_order, is_active")
      .eq("tenant_id", tenantId)
      .eq("product_id", productId)
      .order("display_order"),
  ]);

  const variantIds = (variantsRes.data ?? []).map((v) => v.id);
  const extraIds = (extrasRes.data ?? []).map((e) => e.id);

  const [productTranslations, variantNameMap, extraNameMap] = await Promise.all([
    loadTranslations(tenantId, "product", [productId]),
    loadTranslations(tenantId, "product_variant", variantIds),
    loadTranslations(tenantId, "product_extra", extraIds),
  ]);

  return {
    product: {
      id: product.id,
      categoryId: product.category_id,
      trackMode: product.track_mode as AdminProduct["trackMode"],
      basePriceMinor: product.base_price_minor,
      stockQuantity: product.stock_quantity,
      isSoldOut: product.is_sold_out,
      displayOrder: product.display_order,
      isActive: product.is_active,
      name: readTranslation(productTranslations, "product", product.id, "name"),
      description: readTranslation(productTranslations, "product", product.id, "description"),
      imageUrl: product.image_url,
    },
    variants: (variantsRes.data ?? []).map((v) => ({
      id: v.id,
      productId: v.product_id,
      priceMinor: v.price_minor,
      stockQuantity: v.stock_quantity,
      isSoldOut: v.is_sold_out,
      displayOrder: v.display_order,
      isActive: v.is_active,
      name: readTranslation(variantNameMap, "product_variant", v.id, "name"),
    })),
    extras: (extrasRes.data ?? []).map((e) => ({
      id: e.id,
      productId: e.product_id,
      priceMinor: e.price_minor,
      stockQuantity: e.stock_quantity,
      isSoldOut: e.is_sold_out,
      displayOrder: e.display_order,
      isActive: e.is_active,
      name: readTranslation(extraNameMap, "product_extra", e.id, "name"),
    })),
  };
}

export async function getProductGallery(tenantId: string): Promise<ProductGalleryImage[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("product_images")
    .select("id, storage_path")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(24);

  return (data ?? []).map((row) => ({
    id: row.id,
    url: supabase.storage.from("menu-images").getPublicUrl(row.storage_path).data.publicUrl,
  }));
}
