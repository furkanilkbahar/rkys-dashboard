import { afterAll, describe, expect, it } from "vitest";

import { createThrowawayTenant, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const cleanupTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of cleanupTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

async function setupTenant(prefix: string, { courierEnabled = true }: { courierEnabled?: boolean } = {}) {
  const tenant = await createThrowawayTenant(prefix);
  cleanupTenantIds.add(tenant.tenantId);
  const service = serviceRoleClient();
  await service.from("tenant_modules").insert([{ tenant_id: tenant.tenantId, module_key: "courier", is_enabled: courierEnabled }]);
  const owner = await signInAsSeededOwner(tenant.email);
  return { ...tenant, owner };
}

async function createCourier(tenantId: string) {
  const service = serviceRoleClient();
  const email = `courier-${crypto.randomUUID().slice(0, 8)}@test-throwaway.test`;
  const { data: authUser } = await service.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: tenantId, role: "courier", is_active: true });
  const courier = await signInAsSeededOwner(email);
  return { courierId: authUser!.user!.id as string, courier };
}

describe("update_courier_location RPC (Faz 16 Adım 1, S66)", () => {
  it("owner (courier olmayan bir rol) konum güncelleyemez", async () => {
    const { owner } = await setupTenant("courier-loc-role-guard");
    const { error } = await owner.rpc("update_courier_location", { p_latitude: 41.0, p_longitude: 29.0 });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("courier only");
  });

  it("courier modülü kapalıysa kurye bile konum güncelleyemez", async () => {
    const { tenantId } = await setupTenant("courier-loc-module-guard", { courierEnabled: false });
    const { courier } = await createCourier(tenantId);
    const { error } = await courier.rpc("update_courier_location", { p_latitude: 41.0, p_longitude: 29.0 });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("courier module not enabled");
  });

  it("kurye kendi konumunu yazar ve tekrar çağrıda upsert eder (tek satır)", async () => {
    const { tenantId } = await setupTenant("courier-loc-upsert");
    const { courierId, courier } = await createCourier(tenantId);

    const { error: firstError } = await courier.rpc("update_courier_location", { p_latitude: 41.015, p_longitude: 28.979 });
    expect(firstError).toBeNull();

    const service = serviceRoleClient();
    const { data: firstRow } = await service.from("courier_locations").select("latitude, longitude").eq("courier_id", courierId).single();
    expect(firstRow).toEqual({ latitude: 41.015, longitude: 28.979 });

    const { error: secondError } = await courier.rpc("update_courier_location", { p_latitude: 41.02, p_longitude: 28.98 });
    expect(secondError).toBeNull();

    const { data: rows } = await service.from("courier_locations").select("latitude, longitude").eq("courier_id", courierId);
    expect(rows).toHaveLength(1);
    expect(rows![0]).toEqual({ latitude: 41.02, longitude: 28.98 });
  });

  it("başka bir tenant'ın personeli konumu göremez (RLS izolasyonu)", async () => {
    const { tenantId: tenantAId } = await setupTenant("courier-loc-isolation-a");
    const { courierId, courier } = await createCourier(tenantAId);
    await courier.rpc("update_courier_location", { p_latitude: 41.0, p_longitude: 29.0 });

    const { owner: ownerB } = await setupTenant("courier-loc-isolation-b");
    const { data, error } = await ownerB.from("courier_locations").select("courier_id").eq("courier_id", courierId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
