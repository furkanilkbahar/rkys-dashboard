import { describe, expect, it } from "vitest";

import { SEED, serviceRoleClient } from "../../helpers/testClients";

const EXPECTED_TABLES = [
  "tenants",
  "tenant_domains",
  "branches",
  "profiles",
  "staff_branch_assignments",
  "role_permissions",
  "staff_devices",
  "tenant_modules",
] as const;

describe("Şema ve seed verisi (Supabase Studio manuel kontrolünün otomatik karşılığı)", () => {
  it.each(EXPECTED_TABLES)("public.%s tablosu var ve sorgulanabilir", async (table) => {
    const { error } = await serviceRoleClient()
      .from(table)
      .select("*", { count: "exact", head: true });
    expect(error).toBeNull();
  });

  it("seed: 2 tenant yüklü (acme, beta)", async () => {
    const { data, error } = await serviceRoleClient().from("tenants").select("slug").order("slug");
    expect(error).toBeNull();
    expect(data?.map((row) => row.slug)).toEqual(["acme", "beta"]);
  });

  it("seed: 2 şube yüklü", async () => {
    const { count, error } = await serviceRoleClient()
      .from("branches")
      .select("*", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(count).toBe(2);
  });

  it("seed: tenant_modules 15 modül × 2 tenant = 30 satır; acme.pos_cash açık, beta.pos_cash kapalı", async () => {
    const client = serviceRoleClient();
    const { count, error } = await client
      .from("tenant_modules")
      .select("*", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(count).toBe(30);

    const { data: acme } = await client
      .from("tenant_modules")
      .select("is_enabled")
      .eq("tenant_id", SEED.acme.tenantId)
      .eq("module_key", "pos_cash")
      .maybeSingle();
    const { data: beta } = await client
      .from("tenant_modules")
      .select("is_enabled")
      .eq("tenant_id", SEED.beta.tenantId)
      .eq("module_key", "pos_cash")
      .maybeSingle();

    expect(acme?.is_enabled).toBe(true);
    expect(beta?.is_enabled).toBe(false);
  });

  it("seed: role_permissions 2 rol × 8 izin × 2 tenant = 32 satır", async () => {
    const { count, error } = await serviceRoleClient()
      .from("role_permissions")
      .select("*", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(count).toBe(32);
  });
});
