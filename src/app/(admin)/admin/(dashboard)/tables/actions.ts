"use server";

import { revalidatePath } from "next/cache";

import { getCurrentActor } from "@/lib/auth/session";
import { decryptToken, encryptToken, generateRawToken, hashToken } from "@/lib/qr/token";
import {
  genericQrFormSchema,
  tableFormSchema,
  zoneFormSchema,
  type QrRevealResult,
  type TableActionResult,
} from "@/lib/tables/schemas";
import { createClient } from "@/lib/supabase/server";

async function requireStaffActor() {
  const actor = await getCurrentActor();
  return actor;
}

export async function createZone(branchId: string, input: unknown): Promise<TableActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = zoneFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("table_zones")
    .insert({ tenant_id: actor.tenantId, branch_id: branchId, name: parsed.data.name, is_active: parsed.data.isActive });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/tables");
  return { ok: true };
}

export async function updateZone(zoneId: string, input: unknown): Promise<TableActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = zoneFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("table_zones")
    .update({ name: parsed.data.name, is_active: parsed.data.isActive })
    .eq("id", zoneId)
    .eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/tables");
  return { ok: true };
}

export async function createTable(branchId: string, input: unknown): Promise<QrRevealResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = tableFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const rawToken = generateRawToken();
  const supabase = await createClient();
  const { error } = await supabase.from("tables").insert({
    tenant_id: actor.tenantId,
    branch_id: branchId,
    label: parsed.data.label,
    zone_id: parsed.data.zoneId === "" ? null : parsed.data.zoneId,
    is_active: parsed.data.isActive,
    qr_token_hash: hashToken(rawToken),
    qr_token_encrypted: encryptToken(rawToken),
  });
  if (error) {
    if (error.message.includes("plan table limit reached")) return { ok: false, error: "plan_limit_reached" };
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/admin/tables");
  return { ok: true, rawToken, guestPath: `/masa/t/${rawToken}` };
}

export async function updateTable(tableId: string, input: unknown): Promise<TableActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = tableFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tables")
    .update({
      label: parsed.data.label,
      zone_id: parsed.data.zoneId === "" ? null : parsed.data.zoneId,
      is_active: parsed.data.isActive,
    })
    .eq("id", tableId)
    .eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/tables");
  return { ok: true };
}

/**
 * Yeniden oluşturma eski fiziksel QR'ı geçersiz kılar (yeni hash+şifreli
 * kopya eskisinin üzerine yazılır) — kalıcı olarak tekrar görüntülemek
 * için bkz. revealTableQr (D86).
 */
export async function regenerateTableQr(tableId: string): Promise<QrRevealResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const rawToken = generateRawToken();
  const supabase = await createClient();
  const { error } = await supabase
    .from("tables")
    .update({ qr_token_hash: hashToken(rawToken), qr_token_encrypted: encryptToken(rawToken) })
    .eq("id", tableId)
    .eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/tables");
  return { ok: true, rawToken, guestPath: `/masa/t/${rawToken}` };
}

/**
 * D86: eski/mevcut fiziksel QR'ı geçersiz kılmadan (regenerate'in aksine)
 * ham token'ı tekrar gösterir — şifreli kopya yoksa (QR_TOKEN_ENCRYPTION_KEY
 * hiç ayarlanmamışken oluşturulmuş eski bir QR ise) "not_found" döner.
 */
export async function revealTableQr(tableId: string): Promise<QrRevealResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tables")
    .select("qr_token_encrypted")
    .eq("id", tableId)
    .eq("tenant_id", actor.tenantId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "not_found" };

  const rawToken = data.qr_token_encrypted ? decryptToken(data.qr_token_encrypted) : null;
  if (!rawToken) return { ok: false, error: "not_found" };

  return { ok: true, rawToken, guestPath: `/masa/t/${rawToken}` };
}

export async function createGenericQr(branchId: string, input: unknown): Promise<QrRevealResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = genericQrFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const rawToken = generateRawToken();
  const supabase = await createClient();
  const { error } = await supabase.from("generic_qr_codes").insert({
    tenant_id: actor.tenantId,
    branch_id: branchId,
    label: parsed.data.label,
    qr_token_hash: hashToken(rawToken),
    qr_token_encrypted: encryptToken(rawToken),
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/tables");
  return { ok: true, rawToken, guestPath: `/masa/g/${rawToken}` };
}

export async function regenerateGenericQr(genericQrId: string): Promise<QrRevealResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const rawToken = generateRawToken();
  const supabase = await createClient();
  const { error } = await supabase
    .from("generic_qr_codes")
    .update({ qr_token_hash: hashToken(rawToken), qr_token_encrypted: encryptToken(rawToken) })
    .eq("id", genericQrId)
    .eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/tables");
  return { ok: true, rawToken, guestPath: `/masa/g/${rawToken}` };
}

/** D86: bkz. revealTableQr — genel QR'ın tekrar-gösterme karşılığı. */
export async function revealGenericQr(genericQrId: string): Promise<QrRevealResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generic_qr_codes")
    .select("qr_token_encrypted")
    .eq("id", genericQrId)
    .eq("tenant_id", actor.tenantId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "not_found" };

  const rawToken = data.qr_token_encrypted ? decryptToken(data.qr_token_encrypted) : null;
  if (!rawToken) return { ok: false, error: "not_found" };

  return { ok: true, rawToken, guestPath: `/masa/g/${rawToken}` };
}
