import { afterAll, describe, expect, it } from "vitest";

import { createPlatformAdmin, createThrowawayTenant, SEED, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const createdUserIds = new Set<string>();
const createdTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of createdUserIds) {
    await service.auth.admin.deleteUser(id);
  }
  for (const id of createdTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

describe("approve_tenant / reject_tenant RPC'leri (Faz 4 revizyonu Adım 2, S51)", () => {
  it("yalnızca platform_admin çağırabilir", async () => {
    const throwaway = await createThrowawayTenant("approve-forbidden");
    createdTenantIds.add(throwaway.tenantId);
    await serviceRoleClient().from("tenants").update({ status: "pending_approval" }).eq("id", throwaway.tenantId);

    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error: approveError } = await owner.rpc("approve_tenant", { p_tenant_id: throwaway.tenantId });
    expect(approveError).not.toBeNull();

    const { error: rejectError } = await owner.rpc("reject_tenant", { p_tenant_id: throwaway.tenantId });
    expect(rejectError).not.toBeNull();
  });

  it("onaylanınca tenant active olur ve planının modülleri açılır", async () => {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant("approve-happy");
    createdTenantIds.add(throwaway.tenantId);

    const { data: starterPlan } = await service.from("plans").select("id").eq("key", "starter").single();
    await service
      .from("tenants")
      .update({ status: "pending_approval", plan_id: starterPlan!.id })
      .eq("id", throwaway.tenantId);

    const admin = await createPlatformAdmin("approve-happy");
    createdUserIds.add(admin.userId);

    const { error } = await admin.client.rpc("approve_tenant", { p_tenant_id: throwaway.tenantId });
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
  });

  it("reddedilince tenant rejected olur, modül açılmaz", async () => {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant("reject-happy");
    createdTenantIds.add(throwaway.tenantId);
    await service.from("tenants").update({ status: "pending_approval" }).eq("id", throwaway.tenantId);

    const admin = await createPlatformAdmin("reject-happy");
    createdUserIds.add(admin.userId);

    const { error } = await admin.client.rpc("reject_tenant", { p_tenant_id: throwaway.tenantId });
    expect(error).toBeNull();

    const { data: tenant } = await service.from("tenants").select("status").eq("id", throwaway.tenantId).single();
    expect(tenant?.status).toBe("rejected");

    const { data: modules } = await service.from("tenant_modules").select("module_key").eq("tenant_id", throwaway.tenantId);
    expect(modules).toHaveLength(0);
  });

  it("bilinmeyen tenant_id için hata verir", async () => {
    const admin = await createPlatformAdmin("approve-unknown");
    createdUserIds.add(admin.userId);

    const { error } = await admin.client.rpc("approve_tenant", { p_tenant_id: crypto.randomUUID() });
    expect(error).not.toBeNull();
  });
});
