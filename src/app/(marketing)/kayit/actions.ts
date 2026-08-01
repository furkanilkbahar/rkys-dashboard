"use server";

import { registerSchema } from "@/lib/auth/schemas";
import { getDefaultSubscriptionProvider } from "@/lib/subscriptions";
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
 * bir gate mantığı yazmaya gerek yok. Onay öncesi tenant'ın alt-domaini
 * tamamen erişilemez olduğundan, ödeme adımı KÖK domainde (/kayit/odeme)
 * kurulur; providerRef checkout başlamadan önce subscriptions satırına
 * (trg_tenants_create_subscription'ın açtığı trialing satır) service-role
 * bağlamında düz `.update()` ile yazılır — set_subscription_checkout_ref
 * RPC'si is_staff() gerektirir, bu noktada henüz oturum yok.
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

  const provider = getDefaultSubscriptionProvider();

  let checkout;
  try {
    checkout = await provider.createSubscriptionCheckout({
      tenantId,
      planId,
      returnUrl: `http://${ROOT_DOMAIN}/kayit/tamamlandi`,
      checkoutBasePath: "/kayit/odeme",
    });
  } catch {
    await service.from("tenants").delete().eq("id", tenantId);
    await service.auth.admin.deleteUser(authUser.user.id);
    return { ok: false, error: "unknown" };
  }

  const { error: checkoutRefError } = await service
    .from("subscriptions")
    .update({ provider: provider.name, provider_ref: checkout.providerRef })
    .eq("tenant_id", tenantId);
  if (checkoutRefError) return { ok: false, error: "unknown" };

  return { ok: true, redirectUrl: checkout.checkoutUrl };
}
