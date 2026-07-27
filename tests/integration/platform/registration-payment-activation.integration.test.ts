import { afterAll, describe, expect, it } from "vitest";

import { createThrowawayTenant, serviceRoleClient } from "../../helpers/testClients";

const createdTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of createdTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
  // Global platform ayarı — testler bitince varsayılana (kapalı) döner.
  await service.from("platform_settings").update({ auto_approve_registrations: false }).eq("id", true);
});

async function setPendingWithCheckoutRef(tenantId: string, planId: string) {
  const service = serviceRoleClient();
  const providerRef = crypto.randomUUID();
  await service.from("tenants").update({ status: "pending_approval", plan_id: planId }).eq("id", tenantId);
  await service.from("subscriptions").update({ provider: "mock", provider_ref: providerRef }).eq("tenant_id", tenantId);
  return providerRef;
}

describe("activate_subscription genişlemesi: kayıt onayı ile ödeme bağlanması (Faz 4 revizyonu Adım 3, S52)", () => {
  it("auto_approve_registrations KAPALIYKEN: ödeme aktifleşir ama tenant pending_approval kalır, modül açılmaz", async () => {
    const service = serviceRoleClient();
    await service.from("platform_settings").update({ auto_approve_registrations: false }).eq("id", true);

    const throwaway = await createThrowawayTenant("activate-manual");
    createdTenantIds.add(throwaway.tenantId);
    const { data: starterPlan } = await service.from("plans").select("id").eq("key", "starter").single();
    const providerRef = await setPendingWithCheckoutRef(throwaway.tenantId, starterPlan!.id);

    const { error } = await service.rpc("activate_subscription", { p_provider: "mock", p_provider_ref: providerRef });
    expect(error).toBeNull();

    const { data: subscription } = await service
      .from("subscriptions")
      .select("status")
      .eq("tenant_id", throwaway.tenantId)
      .single();
    expect(subscription?.status).toBe("active");

    const { data: tenant } = await service.from("tenants").select("status").eq("id", throwaway.tenantId).single();
    expect(tenant?.status).toBe("pending_approval");

    const { data: modules } = await service.from("tenant_modules").select("module_key").eq("tenant_id", throwaway.tenantId);
    expect(modules).toHaveLength(0);
  });

  it("auto_approve_registrations AÇIKKEN: ödeme sonrası tenant anında active olur ve planının modülleri açılır", async () => {
    const service = serviceRoleClient();
    await service.from("platform_settings").update({ auto_approve_registrations: true }).eq("id", true);

    const throwaway = await createThrowawayTenant("activate-auto");
    createdTenantIds.add(throwaway.tenantId);
    const { data: starterPlan } = await service.from("plans").select("id").eq("key", "starter").single();
    const providerRef = await setPendingWithCheckoutRef(throwaway.tenantId, starterPlan!.id);

    const { error } = await service.rpc("activate_subscription", { p_provider: "mock", p_provider_ref: providerRef });
    expect(error).toBeNull();

    const { data: tenant } = await service.from("tenants").select("status").eq("id", throwaway.tenantId).single();
    expect(tenant?.status).toBe("active");

    const { data: modules } = await service
      .from("tenant_modules")
      .select("module_key, is_enabled, source")
      .eq("tenant_id", throwaway.tenantId)
      .order("module_key");
    expect(modules!.map((m) => m.module_key).sort()).toEqual(["inventory", "pos_cash"]);
    expect(modules!.every((m) => m.is_enabled && m.source === "plan")).toBe(true);

    await service.from("platform_settings").update({ auto_approve_registrations: false }).eq("id", true);
  });

  it("zaten active olan bir tenant için normal abonelik yenilemesi tenant.status'a dokunmaz (regresyon)", async () => {
    const service = serviceRoleClient();
    await service.from("platform_settings").update({ auto_approve_registrations: true }).eq("id", true);

    const throwaway = await createThrowawayTenant("activate-active-noop");
    createdTenantIds.add(throwaway.tenantId);
    const providerRef = crypto.randomUUID();
    await service.from("subscriptions").update({ provider: "mock", provider_ref: providerRef }).eq("tenant_id", throwaway.tenantId);

    const { error } = await service.rpc("activate_subscription", { p_provider: "mock", p_provider_ref: providerRef });
    expect(error).toBeNull();

    const { data: tenant } = await service.from("tenants").select("status").eq("id", throwaway.tenantId).single();
    expect(tenant?.status).toBe("active");

    await service.from("platform_settings").update({ auto_approve_registrations: false }).eq("id", true);
  });
});
