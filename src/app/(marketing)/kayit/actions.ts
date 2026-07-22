"use server";

import { registerSchema } from "@/lib/auth/schemas";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type RegisterResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; error: "invalid_input" | "slug_taken" | "email_taken" | "unknown" };

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN!;

/**
 * createThrowawayTenant (tests/helpers/testClients.ts) ile aynı iskelet
 * (tenant+branch+tenant_domains+auth user+profile) — abonelik satırı ise
 * artık trg_tenants_create_subscription (Adım 3) tarafından otomatik açılır.
 * Servis-rolüyle oluşturulduğu için tarayıcının henüz oturumu yok; kullanıcı
 * tenant'ın KENDİ subdomain'indeki giriş sayfasına yönlendirilir (subdomain'ler
 * arası oturum devri, Supabase'in magic-link implicit-flow davranışı yüzünden
 * güvenilir çalışmıyor — kullanıcı zaten az önce girdiği şifreyle giriş yapar,
 * ardından mevcut onboarding yönlendirmesi (dashboard layout) devreye girer).
 */
export async function registerTenant(input: unknown): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const { businessName, slug, email, password } = parsed.data;
  const service = createServiceRoleClient();
  const domain = `${slug}.${ROOT_DOMAIN}`;

  const { data: existingDomain } = await service.from("tenant_domains").select("id").eq("domain", domain).maybeSingle();
  if (existingDomain) return { ok: false, error: "slug_taken" };

  const tenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();

  const { error: tenantError } = await service.from("tenants").insert({
    id: tenantId,
    slug,
    name: businessName,
    status: "active",
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

  return { ok: true, redirectUrl: `http://${domain}/admin/login` };
}
