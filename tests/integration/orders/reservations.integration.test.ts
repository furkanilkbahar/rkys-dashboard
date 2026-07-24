import { afterAll, describe, expect, it } from "vitest";

import { createThrowawayTenant, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const cleanupTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of cleanupTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

async function setupTenant(prefix: string, reservationsEnabled = true) {
  const tenant = await createThrowawayTenant(prefix);
  cleanupTenantIds.add(tenant.tenantId);
  const service = serviceRoleClient();
  await service.from("tenant_modules").insert({ tenant_id: tenant.tenantId, module_key: "reservations", is_enabled: reservationsEnabled });
  const owner = await signInAsSeededOwner(tenant.email);
  return { ...tenant, owner };
}

describe("reservations/waitlist_entries RLS izolasyonu (Faz 11 Adım 0, S45)", () => {
  it("personel kendi tenant'ının rezervasyonunu ekleyebilir ve görebilir", async () => {
    const { tenantId, branchId, owner } = await setupTenant("reservation-rls-own");
    const { error: insertError } = await owner.from("reservations").insert({
      tenant_id: tenantId,
      branch_id: branchId,
      customer_name: "Ayşe",
      customer_phone: "05551112233",
      party_size: 4,
      reserved_at: new Date().toISOString(),
      status: "confirmed",
    });
    expect(insertError).toBeNull();

    const { data } = await owner.from("reservations").select("id").eq("tenant_id", tenantId);
    expect(data).toHaveLength(1);
  });

  it("A tenant'ının personeli B tenant'ının rezervasyonunu göremez", async () => {
    const { tenantId: tenantAId, branchId: branchAId } = await setupTenant("reservation-rls-a");
    const { owner: ownerB } = await setupTenant("reservation-rls-b");
    const service = serviceRoleClient();
    await service.from("reservations").insert({
      tenant_id: tenantAId,
      branch_id: branchAId,
      customer_name: "Ayşe",
      customer_phone: "05551112233",
      party_size: 2,
      reserved_at: new Date().toISOString(),
      status: "pending",
    });

    const { data } = await ownerB.from("reservations").select("id").eq("tenant_id", tenantAId);
    expect(data).toHaveLength(0);
  });

  it("personel kendi tenant'ının bekleme listesine ekleyebilir ve görebilir", async () => {
    const { tenantId, branchId, owner } = await setupTenant("waitlist-rls-own");
    const { error: insertError } = await owner
      .from("waitlist_entries")
      .insert({ tenant_id: tenantId, branch_id: branchId, customer_name: "Mehmet", party_size: 3 });
    expect(insertError).toBeNull();

    const { data } = await owner.from("waitlist_entries").select("id, status").eq("tenant_id", tenantId);
    expect(data).toHaveLength(1);
    expect(data![0].status).toBe("waiting");
  });

  it("A tenant'ının personeli B tenant'ının bekleme listesini göremez", async () => {
    const { tenantId: tenantAId, branchId: branchAId } = await setupTenant("waitlist-rls-a");
    const { owner: ownerB } = await setupTenant("waitlist-rls-b");
    const service = serviceRoleClient();
    await service.from("waitlist_entries").insert({ tenant_id: tenantAId, branch_id: branchAId, customer_name: "Mehmet", party_size: 3 });

    const { data } = await ownerB.from("waitlist_entries").select("id").eq("tenant_id", tenantAId);
    expect(data).toHaveLength(0);
  });
});

describe("createPublicReservation (Faz 11 Adım 0, S45)", () => {
  it("misafir rezervasyon talebi 'pending' olarak oluşturur", async () => {
    const { tenantId } = await setupTenant("public-reservation-ok");

    const { createPublicReservation } = await import("@/app/(menu)/rezervasyon/actions");
    const result = await createPublicReservation(tenantId, {
      customerName: "Fatma",
      customerPhone: "05559998877",
      partySize: 2,
      reservedAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(result.ok).toBe(true);

    const service = serviceRoleClient();
    const { data } = await service.from("reservations").select("status, customer_name").eq("tenant_id", tenantId).single();
    expect(data?.status).toBe("pending");
    expect(data?.customer_name).toBe("Fatma");
  });

  it("reservations modülü kapalıyken reddedilir", async () => {
    const { tenantId } = await setupTenant("public-reservation-disabled", false);

    const { createPublicReservation } = await import("@/app/(menu)/rezervasyon/actions");
    const result = await createPublicReservation(tenantId, {
      customerName: "Fatma",
      customerPhone: "05559998877",
      partySize: 2,
      reservedAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(result).toEqual({ ok: false, error: "not_enabled" });
  });

  it("geçersiz girdi reddedilir", async () => {
    const { tenantId } = await setupTenant("public-reservation-invalid");

    const { createPublicReservation } = await import("@/app/(menu)/rezervasyon/actions");
    const result = await createPublicReservation(tenantId, { customerName: "", customerPhone: "", partySize: 0, reservedAt: "not-a-date" });
    expect(result).toEqual({ ok: false, error: "invalid_input" });
  });
});
