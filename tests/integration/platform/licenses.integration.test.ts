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

describe("licenses RLS (Faz 4 Adım 4)", () => {
  it("platform_admin lisans oluşturabilir, listeleyebilir, siler", async () => {
    const admin = await createPlatformAdmin("licenses-crud");
    createdUserIds.add(admin.userId);
    const throwaway = await createThrowawayTenant("license-crud");
    createdTenantIds.add(throwaway.tenantId);

    const { data: created, error: createError } = await admin.client
      .from("licenses")
      .insert({
        tenant_id: throwaway.tenantId,
        license_type: "lifetime",
        license_key: `test-license-${crypto.randomUUID()}`,
      })
      .select("id")
      .single();
    expect(createError).toBeNull();

    const { data: listed, error: listError } = await admin.client.from("licenses").select("id").eq("id", created!.id);
    expect(listError).toBeNull();
    expect(listed).toHaveLength(1);

    const { error: deleteError } = await admin.client.from("licenses").delete().eq("id", created!.id);
    expect(deleteError).toBeNull();
  });

  it("normal personel lisansları göremez ve oluşturamaz", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);

    const { data, error } = await owner.from("licenses").select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    const { error: insertError } = await owner.from("licenses").insert({
      tenant_id: SEED.acme.tenantId,
      license_type: "lifetime",
      license_key: `forbidden-${crypto.randomUUID()}`,
    });
    expect(insertError).not.toBeNull();
  });

  it("license_key benzersiz olmalı", async () => {
    const admin = await createPlatformAdmin("licenses-unique");
    createdUserIds.add(admin.userId);
    const throwaway = await createThrowawayTenant("license-unique");
    createdTenantIds.add(throwaway.tenantId);

    const duplicateKey = `dup-license-${crypto.randomUUID()}`;
    const { error: firstError } = await admin.client
      .from("licenses")
      .insert({ tenant_id: throwaway.tenantId, license_type: "lifetime", license_key: duplicateKey });
    expect(firstError).toBeNull();

    const { error: secondError } = await admin.client
      .from("licenses")
      .insert({ tenant_id: throwaway.tenantId, license_type: "self_hosted", license_key: duplicateKey });
    expect(secondError).not.toBeNull();
  });
});
