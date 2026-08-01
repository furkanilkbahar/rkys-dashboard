import { afterAll, describe, expect, it } from "vitest";

import { registerTenant } from "../../../src/app/(marketing)/kayit/actions";
import { serviceRoleClient } from "../../helpers/testClients";

// registerTenant, getCurrentActor/cookies() gibi Next.js istek bağlamına
// bağımlı olmadığından (yalnızca service-role client + process.env) burada
// doğrudan çağrılabiliyor — diğer server action'ların aksine (bkz. diğer
// entegrasyon testlerinin RPC/RLS katmanını test etme kuralı).
const createdTenantIds = new Set<string>();
const createdUserIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of createdTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
  for (const id of createdUserIds) {
    await service.auth.admin.deleteUser(id);
  }
});

async function starterPlanId() {
  const { data } = await serviceRoleClient().from("plans").select("id").eq("key", "starter").single();
  return data!.id as string;
}

describe("registerTenant (Faz 4 revizyonu Adım 3, S52 — D80 kapalı kapı kayıt)", () => {
  it("yeni tenant pending_approval olarak oluşur, planı atanır, checkout ödeme sayfasına yönlendirir", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const slug = `test-register-${suffix}`;
    const email = `owner-register-${suffix}@test-throwaway.test`;
    const planId = await starterPlanId();

    const result = await registerTenant({
      businessName: "Test İşletmesi",
      slug,
      email,
      password: "password123",
      planId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.redirectUrl).toContain("/kayit/odeme/");

    const service = serviceRoleClient();
    const { data: tenant } = await service
      .from("tenants")
      .select("id, name, status, plan_id, onboarding_completed_at")
      .eq("slug", slug)
      .single();
    expect(tenant).not.toBeNull();
    expect(tenant?.name).toBe("Test İşletmesi");
    expect(tenant?.status).toBe("pending_approval");
    expect(tenant?.plan_id).toBe(planId);
    expect(tenant?.onboarding_completed_at).toBeNull();
    createdTenantIds.add(tenant!.id);

    const { data: branch } = await service.from("branches").select("id, is_default").eq("tenant_id", tenant!.id).single();
    expect(branch?.is_default).toBe(true);

    const { data: domain } = await service
      .from("tenant_domains")
      .select("domain, is_primary")
      .eq("tenant_id", tenant!.id)
      .single();
    expect(domain?.domain).toBe(`${slug}.localhost:3000`);
    expect(domain?.is_primary).toBe(true);

    const { data: profile } = await service.from("profiles").select("id, role, is_active").eq("tenant_id", tenant!.id).single();
    expect(profile?.role).toBe("owner");
    expect(profile?.is_active).toBe(true);
    createdUserIds.add(profile!.id);

    const { data: subscription } = await service
      .from("subscriptions")
      .select("status, trial_ends_at, provider, provider_ref")
      .eq("tenant_id", tenant!.id)
      .single();
    expect(subscription?.status).toBe("trialing");
    expect(subscription?.trial_ends_at).not.toBeNull();
    expect(subscription?.provider).toBe("mock");
    expect(subscription?.provider_ref).toBeTruthy();

    // bug-hunt 2026-08-01: yeni tenant'lar 'water'/'check'/'assistance'
    // sistem call_types'ları olmadan oluşuyordu — call_waiter RPC'si sabit
    // bu key'lere göre satır aradığından "Hesap İste" (ve "Su İstiyorum")
    // her zaman "invalid call type" ile başarısız olurdu (seed.sql'in
    // acme/beta'yı elle bu satırlarla doldurması bunu yalnızca local dev'de
    // gizliyordu). registerTenant artık ensure_system_call_types RPC'sini
    // çağırıyor.
    const { data: callTypes } = await service
      .from("call_types")
      .select("key, is_system")
      .eq("tenant_id", tenant!.id)
      .order("display_order");
    expect(callTypes?.map((c) => c.key).sort()).toEqual(["assistance", "check", "water"]);
    expect(callTypes?.every((c) => c.is_system)).toBe(true);
  });

  it("aynı alt alan adı ikinci kez kullanılamaz", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const slug = `test-register-dup-${suffix}`;
    const planId = await starterPlanId();

    const first = await registerTenant({
      businessName: "İlk İşletme",
      slug,
      email: `owner-dup1-${suffix}@test-throwaway.test`,
      password: "password123",
      planId,
    });
    expect(first.ok).toBe(true);
    if (first.ok) {
      const service = serviceRoleClient();
      const { data: tenant } = await service.from("tenants").select("id").eq("slug", slug).single();
      if (tenant) createdTenantIds.add(tenant.id);
    }

    const second = await registerTenant({
      businessName: "İkinci İşletme",
      slug,
      email: `owner-dup2-${suffix}@test-throwaway.test`,
      password: "password123",
      planId,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toBe("slug_taken");
    }
  });

  it("geçersiz slug (büyük harf/özel karakter) reddedilir", async () => {
    const planId = await starterPlanId();
    const result = await registerTenant({
      businessName: "Geçersiz",
      slug: "Invalid Slug!",
      email: `owner-invalid-${crypto.randomUUID().slice(0, 8)}@test-throwaway.test`,
      password: "password123",
      planId,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("invalid_input");
    }
  });

  it("rezerve edilmiş bir slug (ör. 'admin') reddedilir", async () => {
    const planId = await starterPlanId();
    const result = await registerTenant({
      businessName: "Rezerve",
      slug: "admin",
      email: `owner-reserved-${crypto.randomUUID().slice(0, 8)}@test-throwaway.test`,
      password: "password123",
      planId,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("invalid_input");
    }
  });

  it("bilinmeyen/geçersiz plan id reddedilir", async () => {
    const result = await registerTenant({
      businessName: "Plansız",
      slug: `test-register-noplan-${crypto.randomUUID().slice(0, 8)}`,
      email: `owner-noplan-${crypto.randomUUID().slice(0, 8)}@test-throwaway.test`,
      password: "password123",
      planId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("invalid_input");
    }
  });
});
