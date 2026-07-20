import { describe, expect, it } from "vitest";

import { SEED, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

describe("RLS: product_images", () => {
  it("acme owner sadece kendi tenant'ının galerisini görür", async () => {
    const service = serviceRoleClient();
    await service.from("product_images").insert([
      { tenant_id: SEED.acme.tenantId, storage_path: `${SEED.acme.tenantId}/products/a.webp` },
      { tenant_id: SEED.beta.tenantId, storage_path: `${SEED.beta.tenantId}/products/b.webp` },
    ]);

    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acme.from("product_images").select("tenant_id");

    expect(error).toBeNull();
    expect(data?.every((row) => row.tenant_id === SEED.acme.tenantId)).toBe(true);
  });

  it("acme owner, beta'nın tenant_id'siyle galeri satırı INSERT edemez", async () => {
    const acme = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await acme
      .from("product_images")
      .insert({ tenant_id: SEED.beta.tenantId, storage_path: `${SEED.beta.tenantId}/products/x.webp` });

    expect(error).not.toBeNull();
  });
});
