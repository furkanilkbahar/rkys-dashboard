import { afterAll, describe, expect, it } from "vitest";

import { SEED, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

let openedShiftId: string | null = null;

afterAll(async () => {
  // Test bir vardiyayı açık bırakırsa (assertion başarısız olup erken
  // dönerse) sonraki koşumlar "already open" ile kırılmasın diye zorla kapat.
  if (openedShiftId) {
    await serviceRoleClient().from("cash_shifts").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", openedShiftId);
  }
});

describe("RPC: kasa vardiyası", () => {
  it("her şube otomatik bir 'Tezgâh' masasıyla gelir", async () => {
    const service = serviceRoleClient();
    const { data } = await service
      .from("tables")
      .select("id, label, is_counter")
      .eq("branch_id", SEED.acme.branchId)
      .eq("is_counter", true)
      .maybeSingle();

    expect(data?.label).toBe("Tezgâh");
  });

  it("open_shift: owner vardiya açar, aynı şube için ikincisi reddedilir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data: shiftId, error } = await owner.rpc("open_shift", {
      p_branch_id: SEED.acme.branchId,
      p_opening_balance_minor: 50000,
    });
    expect(error).toBeNull();
    expect(shiftId).toBeTruthy();
    openedShiftId = shiftId as string;

    const { error: secondError } = await owner.rpc("open_shift", {
      p_branch_id: SEED.acme.branchId,
      p_opening_balance_minor: 10000,
    });
    expect(secondError).not.toBeNull();
  });

  it("waiter (cash.open_close izni yok) vardiya açamaz", async () => {
    const waiter = await signInAsSeededOwner(SEED.acme.waiterEmail);
    const { error } = await waiter.rpc("open_shift", {
      p_branch_id: SEED.acme.branchId,
      p_opening_balance_minor: 10000,
    });
    expect(error).not.toBeNull();
  });

  it("record_cash_movement + close_shift: beklenen/sayılan/fark doğru hesaplanır", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    expect(openedShiftId).toBeTruthy();

    await owner.rpc("record_cash_movement", {
      p_shift_id: openedShiftId!,
      p_movement_type: "cash_in",
      p_amount_minor: 5000,
      p_note: "test giriş",
    });
    await owner.rpc("record_cash_movement", {
      p_shift_id: openedShiftId!,
      p_movement_type: "cash_out",
      p_amount_minor: 2000,
      p_note: "test çıkış",
    });

    // beklenen = 50000 (açılış) + 5000 (giriş) - 2000 (çıkış) = 53000
    const { error } = await owner.rpc("close_shift", {
      p_shift_id: openedShiftId!,
      p_counted_cash_minor: 52500,
    });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data: shift } = await service
      .from("cash_shifts")
      .select("status, expected_cash_minor, counted_cash_minor, variance_minor")
      .eq("id", openedShiftId!)
      .single();

    expect(shift?.status).toBe("closed");
    expect(shift?.expected_cash_minor).toBe(53000);
    expect(shift?.counted_cash_minor).toBe(52500);
    expect(shift?.variance_minor).toBe(-500);

    openedShiftId = null; // zaten kapalı, afterAll'da tekrar dokunmasın
  });

  it("close_shift: kapalı bir vardiya tekrar kapatılamaz", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const service = serviceRoleClient();
    const { data: closedShift } = await service
      .from("cash_shifts")
      .select("id")
      .eq("branch_id", SEED.acme.branchId)
      .eq("status", "closed")
      .order("closed_at", { ascending: false })
      .limit(1)
      .single();

    const { error } = await owner.rpc("close_shift", {
      p_shift_id: closedShift!.id,
      p_counted_cash_minor: 0,
    });
    expect(error).not.toBeNull();
  });

  it("RLS: acme owner beta'nın kasa vardiyalarını göremez", async () => {
    const service = serviceRoleClient();
    const { data: betaOwnerProfile } = await service
      .from("profiles")
      .select("id")
      .eq("tenant_id", SEED.beta.tenantId)
      .eq("role", "owner")
      .single();
    const { data: betaShiftId } = await service
      .from("cash_shifts")
      .insert({
        tenant_id: SEED.beta.tenantId,
        branch_id: SEED.beta.branchId,
        opening_balance_minor: 1000,
        opened_by: betaOwnerProfile!.id,
        status: "open",
      })
      .select("id")
      .single();

    const acmeOwner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await acmeOwner.from("cash_shifts").select("id").eq("id", betaShiftId!.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    await service.from("cash_shifts").delete().eq("id", betaShiftId!.id);
  });
});
