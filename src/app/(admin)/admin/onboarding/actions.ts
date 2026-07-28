"use server";

import { randomUUID } from "crypto";

import { revalidatePath } from "next/cache";

import { getCurrentActor } from "@/lib/auth/session";
import { optimizeMenuImage } from "@/lib/images/optimize";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, type ImageActionResult } from "@/lib/menu/schemas";
import { MENU_TEMPLATES, menuTemplateImagePath, type MenuTemplateKey } from "@/lib/onboarding/menuTemplates";
import { generateRawToken, hashToken } from "@/lib/qr/token";
import type { SettingsActionResult } from "@/lib/settings/schemas";
import { createClient } from "@/lib/supabase/server";

async function requireStaffActor() {
  return getCurrentActor();
}

export async function clearDemoData(): Promise<SettingsActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_demo_data");
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin", "layout");
  return { ok: true };
}

// Çoklu şablon seçimi (Faz 2 kapsamı genişletildi — demo menü şablonları,
// bkz. PLAN.md): her şablon birden çok kategori + ürün + görsel içerir,
// menu/actions.ts'in genel CRUD sonuç sözleşmesine (id döndürmeyen
// MenuActionResult) bağlı kalmadan kendi içinde ekler.
export async function applyMenuTemplate(templateKey: MenuTemplateKey): Promise<SettingsActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const template = MENU_TEMPLATES.find((t) => t.key === templateKey);
  if (!template) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const translations: { tenant_id: string; entity_type: string; entity_id: string; locale: string; field: string; value: string }[] = [];

  for (const [categoryIndex, category] of template.categories.entries()) {
    const { data: categoryRow, error: categoryError } = await supabase
      .from("menu_categories")
      .insert({ tenant_id: actor.tenantId, layout: "grid", is_active: true, display_order: categoryIndex })
      .select("id")
      .single();
    if (categoryError || !categoryRow) return { ok: false, error: "unknown" };

    translations.push(
      { tenant_id: actor.tenantId, entity_type: "menu_category", entity_id: categoryRow.id, locale: "tr", field: "name", value: category.nameTr },
      { tenant_id: actor.tenantId, entity_type: "menu_category", entity_id: categoryRow.id, locale: "en", field: "name", value: category.nameEn },
    );

    for (const [productIndex, product] of category.products.entries()) {
      const productImageUrl = supabase.storage.from("menu-images").getPublicUrl(menuTemplateImagePath(templateKey, product.slug)).data.publicUrl;
      const { data: productRow, error: productError } = await supabase
        .from("products")
        .insert({
          tenant_id: actor.tenantId,
          category_id: categoryRow.id,
          track_mode: "simple",
          base_price_minor: product.priceMinor,
          display_order: productIndex,
          image_url: productImageUrl,
        })
        .select("id")
        .single();
      if (productError || !productRow) return { ok: false, error: "unknown" };

      translations.push(
        { tenant_id: actor.tenantId, entity_type: "product", entity_id: productRow.id, locale: "tr", field: "name", value: product.nameTr },
        { tenant_id: actor.tenantId, entity_type: "product", entity_id: productRow.id, locale: "en", field: "name", value: product.nameEn },
        { tenant_id: actor.tenantId, entity_type: "product", entity_id: productRow.id, locale: "tr", field: "description", value: product.descriptionTr },
        { tenant_id: actor.tenantId, entity_type: "product", entity_id: productRow.id, locale: "en", field: "description", value: product.descriptionEn },
      );
    }
  }

  await supabase.from("content_translations").upsert(translations);

  revalidatePath("/admin/onboarding");
  return { ok: true };
}

export async function createOnboardingTables(branchId: string, count: number): Promise<SettingsActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };
  if (count < 1 || count > 50) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const rows = Array.from({ length: count }, (_, i) => ({
    tenant_id: actor.tenantId,
    branch_id: branchId,
    label: `Masa ${i + 1}`,
    qr_token_hash: "", // aşağıda tek tek güncellenir (her masa benzersiz ham token ister)
  }));

  // RULES #7: token tahmin edilebilir olamaz — her masa için ayrı, rastgele
  // ham token üretilip yalnız hash'i saklanır (tables/actions.ts'teki
  // createTable ile aynı ilke).
  for (const row of rows) {
    row.qr_token_hash = hashToken(generateRawToken());
  }

  const { error } = await supabase.from("tables").insert(rows);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/onboarding");
  return { ok: true };
}

export async function uploadTenantLogo(formData: FormData): Promise<ImageActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "invalid_input" };
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) return { ok: false, error: "unsupported_type" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "too_large" };

  let optimized: Buffer;
  try {
    optimized = await optimizeMenuImage(Buffer.from(await file.arrayBuffer()));
  } catch {
    return { ok: false, error: "invalid_input" };
  }

  const supabase = await createClient();
  const path = `${actor.tenantId}/logo/${randomUUID()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from("menu-images")
    .upload(path, optimized, { contentType: "image/webp" });
  if (uploadError) return { ok: false, error: "unknown" };

  const imageUrl = supabase.storage.from("menu-images").getPublicUrl(path).data.publicUrl;

  const { error: rpcError } = await supabase.rpc("update_tenant_logo", { p_logo_url: imageUrl });
  if (rpcError) return { ok: false, error: "forbidden" };

  revalidatePath("/admin/onboarding");
  return { ok: true, imageUrl };
}

export async function completeOnboarding(): Promise<SettingsActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_onboarding");
  if (error) return { ok: false, error: "unknown" };

  return { ok: true };
}
