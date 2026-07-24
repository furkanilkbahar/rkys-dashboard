"use server";

import { publicReservationRequestSchema, type ReservationActionResult } from "@/lib/reservations/schemas";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Misafirin ziyaret ÖNCESİ, oturumsuz gönderdiği rezervasyon talebi —
 * registerTenant (marketing/kayit/actions.ts) ile aynı desen: RLS bypass
 * edilir (misafirin hiçbir Supabase oturumu yok), güvenlik Zod doğrulaması +
 * modül kontrolüyle sağlanır. Talep 'pending' olarak düşer, personel
 * /admin/reservations'tan onaylar.
 */
export async function createPublicReservation(tenantId: string, input: unknown): Promise<ReservationActionResult> {
  const parsed = publicReservationRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const service = createServiceRoleClient();

  const { data: module } = await service
    .from("tenant_modules")
    .select("is_enabled")
    .eq("tenant_id", tenantId)
    .eq("module_key", "reservations")
    .maybeSingle();
  if (!module?.is_enabled) return { ok: false, error: "not_enabled" };

  const { data: branch } = await service.from("branches").select("id").eq("tenant_id", tenantId).eq("is_default", true).single();
  if (!branch) return { ok: false, error: "unknown" };

  const { error } = await service.from("reservations").insert({
    tenant_id: tenantId,
    branch_id: branch.id,
    customer_name: parsed.data.customerName,
    customer_phone: parsed.data.customerPhone,
    party_size: parsed.data.partySize,
    reserved_at: parsed.data.reservedAt,
    note: parsed.data.note || null,
    status: "pending",
  });
  if (error) return { ok: false, error: "unknown" };

  return { ok: true };
}
