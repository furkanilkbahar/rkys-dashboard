"use server";

import { revalidatePath } from "next/cache";

import { getCurrentActor } from "@/lib/auth/session";
import { generateRawToken, hashToken } from "@/lib/qr/token";
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
  });
  if (error) return { ok: false, error: "unknown" };

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
 * Ham QR token hiç saklanmaz (RULES #7) — yeniden oluşturma eski fiziksel
 * QR'ı geçersiz kılar (yeni hash eskisinin üzerine yazılır). Yeni ham token
 * yalnızca bu action'ın dönüş değerinde bir kerelik görünür.
 */
export async function regenerateTableQr(tableId: string): Promise<QrRevealResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const rawToken = generateRawToken();
  const supabase = await createClient();
  const { error } = await supabase
    .from("tables")
    .update({ qr_token_hash: hashToken(rawToken) })
    .eq("id", tableId)
    .eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/tables");
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
    .update({ qr_token_hash: hashToken(rawToken) })
    .eq("id", genericQrId)
    .eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/tables");
  return { ok: true, rawToken, guestPath: `/masa/g/${rawToken}` };
}
