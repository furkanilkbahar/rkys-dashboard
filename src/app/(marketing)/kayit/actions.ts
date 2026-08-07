"use server";

import { registerSchema } from "@/lib/auth/schemas";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type RegisterResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; error: "invalid_input" | "slug_taken" | "email_taken" | "unknown" };

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN!;

/**
 * D80: kapalı-kapı kayıt. createThrowawayTenant (tests/helpers/testClients.ts)
 * ile aynı iskelet (tenant+branch+tenant_domains+auth user+profile) ama
 * tenant `pending_approval` ile açılır — proxy.ts'nin `tenant_status !==
 * 'active'` kapısı (0002) admin/login dahil HER isteği kapattığı için ayrıca
 * bir gate mantığı yazmaya gerek yok.
 *
 * D101: D80'in ödeme adımı BURADAN KALDIRILDI. Ana sayfa "14 gün kartsız
 * deneme" vaat ediyor (D18) ama akış kullanıcıyı checkout'a gönderiyordu —
 * üstelik kayıt formunun varsayılanı ₺0'lık Demo planı olduğu için pratikte
 * "₺0 ödeyin" sayfası çıkıyordu. Ödeme /admin/billing'e taşındı.
 */
export async function registerTenant(input: unknown): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const { businessName, slug, email, password, planId } = parsed.data;
  const service = createServiceRoleClient();
  const domain = `${slug}.${ROOT_DOMAIN}`;

  const { data: existingDomain } = await service.from("tenant_domains").select("id").eq("domain", domain).maybeSingle();
  if (existingDomain) return { ok: false, error: "slug_taken" };

  const { data: plan } = await service.from("plans").select("id").eq("id", planId).maybeSingle();
  if (!plan) return { ok: false, error: "invalid_input" };

  const tenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();

  const { error: tenantError } = await service.from("tenants").insert({
    id: tenantId,
    slug,
    name: businessName,
    status: "pending_approval",
    plan_id: planId,
    timezone: "Europe/Istanbul",
    currency: "TRY",
    onboarding_completed_at: null,
  });
  if (tenantError) return { ok: false, error: tenantError.code === "23505" ? "slug_taken" : "unknown" };

  const { error: authUserError, data: authUser } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authUserError || !authUser.user) {
    await service.from("tenants").delete().eq("id", tenantId);
    const isDuplicateEmail = authUserError?.code === "email_exists";
    return { ok: false, error: isDuplicateEmail ? "email_taken" : "unknown" };
  }

  const { error: branchError } = await service.from("branches").insert({ id: branchId, tenant_id: tenantId, name: "Merkez Şube", is_default: true });
  const { error: domainError } = await service.from("tenant_domains").insert({ tenant_id: tenantId, domain, is_primary: true });
  const { error: profileError } = await service
    .from("profiles")
    .insert({ id: authUser.user.id, tenant_id: tenantId, role: "owner", is_active: true });

  if (branchError || domainError || profileError) {
    await service.from("tenants").delete().eq("id", tenantId);
    await service.auth.admin.deleteUser(authUser.user.id);
    return { ok: false, error: "unknown" };
  }

  // bug-hunt 2026-08-01: "su/hesap/yardım" gibi standart çağrı tiplerinin
  // her tenant için var olduğunu garanti eder (D35) — eksikse "Hesap İste"
  // her zaman "invalid call type" ile başarısız olurdu. Kayıt akışını
  // bloklamaz: eksik kalırsa çağrı özelliği geçici olarak çalışmaz, tenant
  // yine de oluşur.
  const { error: callTypesError } = await service.rpc("ensure_system_call_types", { p_tenant_id: tenantId });
  if (callTypesError) {
    console.error("ensure_system_call_types failed for new tenant", tenantId, callTypesError);
  }

  // D101: burada ÖDEME ALINMAZ. trg_tenants_create_subscription (0039)
  // tenant'a zaten 14 günlük `trialing` satırı açtı, yani hesap bu andan
  // itibaren kartsız olarak tam çalışır durumda (D18). Ödeme /admin/billing'e
  // taşındı; trial dolduğunda proxy'nin abonelik kapısı devreye girer.
  //
  // Otomatik onay artık burada: 0076 bunu ödeme webhook'unun içine koymuştu,
  // ödeme adımı kalkınca auto_approve_registrations açık olsa bile hiçbir
  // kayıt otomatik onaylanmazdı. Kayıt akışını bloklamaz — başarısız olursa
  // tenant onay kuyruğunda bekler, ki ayarın kapalı hâlindeki davranış da bu.
  const { error: autoApproveError } = await service.rpc("approve_tenant_on_registration", {
    p_tenant_id: tenantId,
  });
  if (autoApproveError) {
    console.error("approve_tenant_on_registration failed for new tenant", tenantId, autoApproveError);
  }

  return { ok: true, redirectUrl: `http://${ROOT_DOMAIN}/kayit/tamamlandi` };
}
