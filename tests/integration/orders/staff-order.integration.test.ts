import { afterAll, describe, expect, it } from "vitest";

import { SEED, anonClient, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const ACME_COFFEE_PRODUCT_ID = "00000000-0000-4000-8000-000000000201"; // takipsiz stok, 8000 kuruş
const ACME_CHEESECAKE_PRODUCT_ID = "00000000-0000-4000-8000-000000000203"; // tükendi (seed)

const openedSessionIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of openedSessionIds) {
    await service.from("table_sessions").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", id);
  }
});

async function getCounterTableId(tenantId: string, branchId: string) {
  const service = serviceRoleClient();
  const { data } = await service
    .from("tables")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .eq("is_counter", true)
    .single();
  return data!.id as string;
}

describe("RPC: submit_staff_order (POS-lite)", () => {
  it("owner tezgâh masasına sipariş girer, fiyat/stok doğru işlenir, oturum otomatik açılır", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const counterTableId = await getCounterTableId(SEED.acme.tenantId, SEED.acme.branchId);

    const { data, error } = await owner.rpc("submit_staff_order", {
      p_table_id: counterTableId,
      p_items: [{ productId: ACME_COFFEE_PRODUCT_ID, variantId: null, quantity: 2, extraIds: [] }],
    });

    expect(error).toBeNull();
    expect(data?.[0].order_status).toBe("approved"); // POS-lite her zaman doğrudan approved başlar
    expect(data?.[0].subtotal_minor).toBe(16000);

    const service = serviceRoleClient();
    const { data: session } = await service
      .from("table_sessions")
      .select("id, status")
      .eq("table_id", counterTableId)
      .eq("status", "active")
      .single();
    expect(session).toBeTruthy();
    openedSessionIds.add(session!.id);
  });

  it("owner: tükenmiş üründen sipariş girilemez", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const counterTableId = await getCounterTableId(SEED.acme.tenantId, SEED.acme.branchId);

    const { error } = await owner.rpc("submit_staff_order", {
      p_table_id: counterTableId,
      p_items: [{ productId: ACME_CHEESECAKE_PRODUCT_ID, variantId: null, quantity: 1, extraIds: [] }],
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("STOCK_UNAVAILABLE");
  });

  it("misafir (guest) submit_staff_order çağıramaz", async () => {
    const guest = anonClient();
    const { error: authError } = await guest.auth.signInAnonymously();
    expect(authError).toBeNull();

    const counterTableId = await getCounterTableId(SEED.acme.tenantId, SEED.acme.branchId);
    const { error } = await guest.rpc("submit_staff_order", {
      p_table_id: counterTableId,
      p_items: [{ productId: ACME_COFFEE_PRODUCT_ID, variantId: null, quantity: 1, extraIds: [] }],
    });
    expect(error).not.toBeNull();
  });

  it("pos_cash modülü kapalı tenant'ta (beta) sipariş girilemez", async () => {
    const betaOwner = await signInAsSeededOwner(SEED.beta.ownerEmail);
    const counterTableId = await getCounterTableId(SEED.beta.tenantId, SEED.beta.branchId);

    const { error } = await betaOwner.rpc("submit_staff_order", {
      p_table_id: counterTableId,
      p_items: [{ productId: "00000000-0000-4000-8000-000000000204", variantId: null, quantity: 1, extraIds: [] }],
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("pos_cash");
  });

  it("owner mevcut aktif oturuma (aynı masaya) ikinci siparişi ekler, oturum çoğalmaz", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const counterTableId = await getCounterTableId(SEED.acme.tenantId, SEED.acme.branchId);

    const { error } = await owner.rpc("submit_staff_order", {
      p_table_id: counterTableId,
      p_items: [{ productId: ACME_COFFEE_PRODUCT_ID, variantId: null, quantity: 1, extraIds: [] }],
    });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data: sessions } = await service
      .from("table_sessions")
      .select("id")
      .eq("table_id", counterTableId)
      .eq("status", "active");
    expect(sessions).toHaveLength(1);
  });
});
