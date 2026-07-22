import { afterAll, describe, expect, it } from "vitest";

import {
  createPlatformAdmin,
  createThrowawayTenant,
  SEED,
  serviceRoleClient,
  signInAsSeededOwner,
} from "../../helpers/testClients";

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

describe("plans tablosu RLS (Faz 4 Adım 2)", () => {
  it("herkes planları okuyabilir, yalnızca platform_admin güncelleyebilir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await owner.from("plans").select("key");
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(3);

    const { data: updated, error: updateError } = await owner
      .from("plans")
      .update({ name: "hacked" })
      .eq("key", "starter")
      .select();
    expect(updateError).toBeNull();
    expect(updated).toHaveLength(0);
  });
});

describe("masa limiti (RULES #28, S12)", () => {
  it("plan table_limit'i dolunca masa INSERT'i reddedilir, plan kaldırılınca serbest kalır", async () => {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant("table-limit");
    createdTenantIds.add(throwaway.tenantId);

    const { data: starterPlan } = await service.from("plans").select("id, table_limit").eq("key", "starter").single();
    await service.from("tenants").update({ plan_id: starterPlan!.id }).eq("id", throwaway.tenantId);

    // Yeni şube açılınca otomatik bir "tezgâh" masası oluşuyor (0029,
    // trg_branches_create_counter_table) — throwaway tenant zaten 1 masayla
    // başlıyor, limite kadar kalan slot sayısı kadar ekleme yapılır.
    const { count: startingCount } = await service
      .from("tables")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", throwaway.tenantId);
    const remainingSlots = starterPlan!.table_limit! - (startingCount ?? 0);

    for (let i = 0; i < remainingSlots; i++) {
      const { error } = await service.from("tables").insert({
        tenant_id: throwaway.tenantId,
        branch_id: throwaway.branchId,
        label: `Masa ${i}`,
        qr_token_hash: crypto.randomUUID(),
      });
      expect(error).toBeNull();
    }

    const { error: overLimitError } = await service.from("tables").insert({
      tenant_id: throwaway.tenantId,
      branch_id: throwaway.branchId,
      label: "Fazla masa",
      qr_token_hash: crypto.randomUUID(),
    });
    expect(overLimitError).not.toBeNull();
    expect(overLimitError?.message).toContain("plan table limit reached");

    await service.from("tenants").update({ plan_id: null }).eq("id", throwaway.tenantId);
    const { error: afterUnassignError } = await service.from("tables").insert({
      tenant_id: throwaway.tenantId,
      branch_id: throwaway.branchId,
      label: "Sınırsız masa",
      qr_token_hash: crypto.randomUUID(),
    });
    expect(afterUnassignError).toBeNull();
  });
});

describe("create_branch RPC (Faz 4 Adım 2)", () => {
  it("yalnızca owner çağırabilir", async () => {
    const waiter = await signInAsSeededOwner(SEED.acme.waiterEmail);
    const { error } = await waiter.rpc("create_branch", { p_name: "Yetkisiz şube" });
    expect(error).not.toBeNull();
  });

  it("owner şube oluşturabilir; dahil şube sayısını aşınca extra_fee_applies true döner", async () => {
    const throwaway = await createThrowawayTenant("branch-fee");
    createdTenantIds.add(throwaway.tenantId);
    const owner = await signInAsSeededOwner(throwaway.email);

    // plan_id atanmamış (null) -> included_branch_count fallback = 1;
    // throwaway tenant zaten 1 varsayılan şubeyle başlıyor, bu yüzden İLK
    // yeni şube dahil sayıyı aşar.
    const { data, error } = await owner.rpc("create_branch", { p_name: "Şube 2" }).single();
    expect(error).toBeNull();
    expect(data?.extra_fee_applies).toBe(true);

    const { data: branches } = await serviceRoleClient()
      .from("branches")
      .select("id")
      .eq("tenant_id", throwaway.tenantId);
    expect(branches).toHaveLength(2);
  });
});

describe("assign_tenant_plan RPC (Faz 4 Adım 2)", () => {
  it("yalnızca platform_admin çağırabilir, tenant'ın planını değiştirir", async () => {
    const throwaway = await createThrowawayTenant("assign-plan");
    createdTenantIds.add(throwaway.tenantId);
    const admin = await createPlatformAdmin("assign-plan");
    createdUserIds.add(admin.userId);

    const { data: proPlan } = await serviceRoleClient().from("plans").select("id").eq("key", "pro").single();

    const owner = await signInAsSeededOwner(throwaway.email);
    const { error: forbiddenError } = await owner.rpc("assign_tenant_plan", {
      p_tenant_id: throwaway.tenantId,
      p_plan_id: proPlan!.id,
    });
    expect(forbiddenError).not.toBeNull();

    const { error } = await admin.client.rpc("assign_tenant_plan", {
      p_tenant_id: throwaway.tenantId,
      p_plan_id: proPlan!.id,
    });
    expect(error).toBeNull();

    const { data: tenant } = await serviceRoleClient().from("tenants").select("plan_id").eq("id", throwaway.tenantId).single();
    expect(tenant?.plan_id).toBe(proPlan!.id);
  });
});
