"use server";

import { randomUUID } from "crypto";

import { revalidatePath } from "next/cache";

import { assertCan } from "@/lib/auth/can";
import { getCurrentActor } from "@/lib/auth/session";
import { optimizeMenuImage } from "@/lib/images/optimize";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  categoryServerSchema,
  extraServerSchema,
  productServerSchema,
  variantServerSchema,
  type ImageActionResult,
  type MenuActionResult,
} from "@/lib/menu/schemas";
import { createClient } from "@/lib/supabase/server";

async function requireMenuEditActor() {
  const actor = await getCurrentActor();
  if (!actor) {
    return null;
  }
  try {
    await assertCan(actor, "menu.edit");
  } catch {
    return null;
  }
  return actor;
}

async function upsertTranslations(
  tenantId: string,
  entityType: "menu_category" | "product" | "product_variant" | "product_extra",
  entityId: string,
  fields: { field: "name" | "description"; tr: string; en: string }[],
) {
  const supabase = await createClient();
  const rows = fields.flatMap(({ field, tr, en }) => [
    { tenant_id: tenantId, entity_type: entityType, entity_id: entityId, locale: "tr", field, value: tr },
    { tenant_id: tenantId, entity_type: entityType, entity_id: entityId, locale: "en", field, value: en },
  ]);

  await supabase.from("content_translations").upsert(rows, { onConflict: "entity_type,entity_id,locale,field" });
}

export async function createCategory(input: unknown): Promise<MenuActionResult> {
  const actor = await requireMenuEditActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = categoryServerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_categories")
    .insert({ tenant_id: actor.tenantId, layout: parsed.data.layout, is_active: parsed.data.isActive, station: parsed.data.station })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "unknown" };

  await upsertTranslations(actor.tenantId, "menu_category", data.id, [
    { field: "name", tr: parsed.data.nameTr, en: parsed.data.nameEn },
  ]);

  revalidatePath("/admin/menu");
  return { ok: true };
}

export async function updateCategory(categoryId: string, input: unknown): Promise<MenuActionResult> {
  const actor = await requireMenuEditActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = categoryServerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_categories")
    .update({ layout: parsed.data.layout, is_active: parsed.data.isActive, station: parsed.data.station })
    .eq("id", categoryId)
    .eq("tenant_id", actor.tenantId);

  if (error) return { ok: false, error: "unknown" };

  await upsertTranslations(actor.tenantId, "menu_category", categoryId, [
    { field: "name", tr: parsed.data.nameTr, en: parsed.data.nameEn },
  ]);

  revalidatePath("/admin/menu");
  revalidatePath(`/admin/menu/${categoryId}`);
  return { ok: true };
}

export async function createProduct(input: unknown): Promise<MenuActionResult> {
  const actor = await requireMenuEditActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = productServerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      tenant_id: actor.tenantId,
      category_id: parsed.data.categoryId,
      track_mode: "simple",
      base_price_minor: parsed.data.basePrice,
      stock_quantity: parsed.data.stockQuantity,
      is_sold_out: parsed.data.isSoldOut,
      is_active: parsed.data.isActive,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "unknown" };

  await upsertTranslations(actor.tenantId, "product", data.id, [
    { field: "name", tr: parsed.data.nameTr, en: parsed.data.nameEn },
    { field: "description", tr: parsed.data.descriptionTr, en: parsed.data.descriptionEn },
  ]);

  revalidatePath(`/admin/menu/${parsed.data.categoryId}`);
  return { ok: true };
}

export async function updateProduct(productId: string, input: unknown): Promise<MenuActionResult> {
  const actor = await requireMenuEditActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = productServerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({
      category_id: parsed.data.categoryId,
      base_price_minor: parsed.data.basePrice,
      stock_quantity: parsed.data.stockQuantity,
      is_sold_out: parsed.data.isSoldOut,
      is_active: parsed.data.isActive,
    })
    .eq("id", productId)
    .eq("tenant_id", actor.tenantId);

  if (error) return { ok: false, error: "unknown" };

  await upsertTranslations(actor.tenantId, "product", productId, [
    { field: "name", tr: parsed.data.nameTr, en: parsed.data.nameEn },
    { field: "description", tr: parsed.data.descriptionTr, en: parsed.data.descriptionEn },
  ]);

  revalidatePath(`/admin/menu/${parsed.data.categoryId}`);
  revalidatePath(`/admin/menu/${parsed.data.categoryId}/products/${productId}`);
  return { ok: true };
}

export async function createVariant(input: unknown): Promise<MenuActionResult> {
  const actor = await requireMenuEditActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = variantServerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .insert({
      tenant_id: actor.tenantId,
      product_id: parsed.data.productId,
      price_minor: parsed.data.price,
      stock_quantity: parsed.data.stockQuantity,
      is_sold_out: parsed.data.isSoldOut,
      is_active: parsed.data.isActive,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "unknown" };

  await upsertTranslations(actor.tenantId, "product_variant", data.id, [
    { field: "name", tr: parsed.data.nameTr, en: parsed.data.nameEn },
  ]);

  revalidatePath("/admin/menu", "layout");
  return { ok: true };
}

export async function updateVariant(variantId: string, input: unknown): Promise<MenuActionResult> {
  const actor = await requireMenuEditActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = variantServerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_variants")
    .update({
      price_minor: parsed.data.price,
      stock_quantity: parsed.data.stockQuantity,
      is_sold_out: parsed.data.isSoldOut,
      is_active: parsed.data.isActive,
    })
    .eq("id", variantId)
    .eq("tenant_id", actor.tenantId);

  if (error) return { ok: false, error: "unknown" };

  await upsertTranslations(actor.tenantId, "product_variant", variantId, [
    { field: "name", tr: parsed.data.nameTr, en: parsed.data.nameEn },
  ]);

  revalidatePath("/admin/menu", "layout");
  return { ok: true };
}

export async function createExtra(input: unknown): Promise<MenuActionResult> {
  const actor = await requireMenuEditActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = extraServerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_extras")
    .insert({
      tenant_id: actor.tenantId,
      product_id: parsed.data.productId,
      price_minor: parsed.data.price,
      stock_quantity: parsed.data.stockQuantity,
      is_sold_out: parsed.data.isSoldOut,
      is_active: parsed.data.isActive,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "unknown" };

  await upsertTranslations(actor.tenantId, "product_extra", data.id, [
    { field: "name", tr: parsed.data.nameTr, en: parsed.data.nameEn },
  ]);

  revalidatePath("/admin/menu", "layout");
  return { ok: true };
}

export async function updateExtra(extraId: string, input: unknown): Promise<MenuActionResult> {
  const actor = await requireMenuEditActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = extraServerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_extras")
    .update({
      price_minor: parsed.data.price,
      stock_quantity: parsed.data.stockQuantity,
      is_sold_out: parsed.data.isSoldOut,
      is_active: parsed.data.isActive,
    })
    .eq("id", extraId)
    .eq("tenant_id", actor.tenantId);

  if (error) return { ok: false, error: "unknown" };

  await upsertTranslations(actor.tenantId, "product_extra", extraId, [
    { field: "name", tr: parsed.data.nameTr, en: parsed.data.nameEn },
  ]);

  revalidatePath("/admin/menu", "layout");
  return { ok: true };
}

export async function reorderMenuCategories(orderedIds: string[]): Promise<MenuActionResult> {
  const actor = await requireMenuEditActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_menu_categories", { p_ids: orderedIds });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/menu");
  return { ok: true };
}

export async function reorderProducts(categoryId: string, orderedIds: string[]): Promise<MenuActionResult> {
  const actor = await requireMenuEditActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_products", { p_category_id: categoryId, p_ids: orderedIds });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath(`/admin/menu/${categoryId}`);
  return { ok: true };
}

export async function reorderVariants(productId: string, orderedIds: string[]): Promise<MenuActionResult> {
  const actor = await requireMenuEditActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_product_variants", { p_product_id: productId, p_ids: orderedIds });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/menu", "layout");
  return { ok: true };
}

export async function reorderExtras(productId: string, orderedIds: string[]): Promise<MenuActionResult> {
  const actor = await requireMenuEditActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_product_extras", { p_product_id: productId, p_ids: orderedIds });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/menu", "layout");
  return { ok: true };
}

async function extractImageBuffer(
  formData: FormData,
): Promise<{ buffer: Buffer } | { error: "invalid_input" | "too_large" | "unsupported_type" }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "invalid_input" };
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) return { error: "unsupported_type" };
  if (file.size > MAX_IMAGE_BYTES) return { error: "too_large" };

  return { buffer: Buffer.from(await file.arrayBuffer()) };
}

export async function uploadProductImage(productId: string, formData: FormData): Promise<ImageActionResult> {
  const actor = await requireMenuEditActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const extracted = await extractImageBuffer(formData);
  if ("error" in extracted) return { ok: false, error: extracted.error };

  let optimized: Buffer;
  try {
    optimized = await optimizeMenuImage(extracted.buffer);
  } catch {
    return { ok: false, error: "invalid_input" };
  }

  const supabase = await createClient();
  const path = `${actor.tenantId}/products/${productId}-${randomUUID()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from("menu-images")
    .upload(path, optimized, { contentType: "image/webp" });
  if (uploadError) return { ok: false, error: "unknown" };

  const imageUrl = supabase.storage.from("menu-images").getPublicUrl(path).data.publicUrl;

  const { error: updateError } = await supabase
    .from("products")
    .update({ image_url: imageUrl })
    .eq("id", productId)
    .eq("tenant_id", actor.tenantId);
  if (updateError) return { ok: false, error: "unknown" };

  await supabase.from("product_images").insert({ tenant_id: actor.tenantId, storage_path: path });

  revalidatePath("/admin/menu", "layout");
  return { ok: true, imageUrl };
}

export async function uploadCategoryImage(categoryId: string, formData: FormData): Promise<ImageActionResult> {
  const actor = await requireMenuEditActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const extracted = await extractImageBuffer(formData);
  if ("error" in extracted) return { ok: false, error: extracted.error };

  let optimized: Buffer;
  try {
    optimized = await optimizeMenuImage(extracted.buffer);
  } catch {
    return { ok: false, error: "invalid_input" };
  }

  const supabase = await createClient();
  const path = `${actor.tenantId}/categories/${categoryId}-${randomUUID()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from("menu-images")
    .upload(path, optimized, { contentType: "image/webp" });
  if (uploadError) return { ok: false, error: "unknown" };

  const imageUrl = supabase.storage.from("menu-images").getPublicUrl(path).data.publicUrl;

  const { error: updateError } = await supabase
    .from("menu_categories")
    .update({ image_url: imageUrl })
    .eq("id", categoryId)
    .eq("tenant_id", actor.tenantId);
  if (updateError) return { ok: false, error: "unknown" };

  revalidatePath("/admin/menu", "layout");
  return { ok: true, imageUrl };
}

export async function selectProductImageFromGallery(
  productId: string,
  galleryImageId: string,
): Promise<ImageActionResult> {
  const actor = await requireMenuEditActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { data: galleryImage } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("id", galleryImageId)
    .eq("tenant_id", actor.tenantId)
    .maybeSingle();
  if (!galleryImage) return { ok: false, error: "invalid_input" };

  const imageUrl = supabase.storage.from("menu-images").getPublicUrl(galleryImage.storage_path).data.publicUrl;

  const { error } = await supabase
    .from("products")
    .update({ image_url: imageUrl })
    .eq("id", productId)
    .eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/menu", "layout");
  return { ok: true, imageUrl };
}

