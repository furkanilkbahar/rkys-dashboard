import { afterAll, describe, expect, it } from "vitest";

import { bootstrapGuestForTable, SEED, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const openGuestSessionIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of openGuestSessionIds) {
    await service.from("table_sessions").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", id);
  }
  await service.from("staff_performance_goals").delete().eq("tenant_id", SEED.acme.tenantId);
});

describe("set_staff_performance_goal RPC (Faz 16 Adım 0, S65)", () => {
  it("yalnızca staff.manage izni olan çağırabilir", async () => {
    const waiter = await signInAsSeededOwner(SEED.acme.waiterEmail);
    const { data: ownerProfile } = await serviceRoleClient()
      .from("profiles")
      .select("id")
      .eq("tenant_id", SEED.acme.tenantId)
      .eq("role", "owner")
      .single();

    const { error } = await waiter.rpc("set_staff_performance_goal", {
      p_branch_id: SEED.acme.branchId,
      p_profile_id: ownerProfile!.id,
      p_target_calls_resolved: 5,
    });
    expect(error).not.toBeNull();
  });

  it("owner bir personelin hedefini belirler/günceller (upsert)", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const service = serviceRoleClient();
    const { data: waiterProfile } = await service
      .from("profiles")
      .select("id")
      .eq("tenant_id", SEED.acme.tenantId)
      .eq("role", "waiter")
      .single();

    const { error: firstError } = await owner.rpc("set_staff_performance_goal", {
      p_branch_id: SEED.acme.branchId,
      p_profile_id: waiterProfile!.id,
      p_target_calls_resolved: 10,
    });
    expect(firstError).toBeNull();

    const { data: firstRow } = await service
      .from("staff_performance_goals")
      .select("target_calls_resolved")
      .eq("tenant_id", SEED.acme.tenantId)
      .eq("profile_id", waiterProfile!.id)
      .single();
    expect(firstRow?.target_calls_resolved).toBe(10);

    const { error: secondError } = await owner.rpc("set_staff_performance_goal", {
      p_branch_id: SEED.acme.branchId,
      p_profile_id: waiterProfile!.id,
      p_target_calls_resolved: 20,
    });
    expect(secondError).toBeNull();

    const { data: secondRow } = await service
      .from("staff_performance_goals")
      .select("target_calls_resolved")
      .eq("tenant_id", SEED.acme.tenantId)
      .eq("profile_id", waiterProfile!.id)
      .single();
    expect(secondRow?.target_calls_resolved).toBe(20);
  });

  it("bilinmeyen profile_id için hata verir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await owner.rpc("set_staff_performance_goal", {
      p_branch_id: SEED.acme.branchId,
      p_profile_id: crypto.randomUUID(),
      p_target_calls_resolved: 5,
    });
    expect(error).not.toBeNull();
  });
});

describe("garson çağrısı karşılama → personel performansı (Faz 16 Adım 0, S65)", () => {
  it("acknowledge_waiter_call, acknowledged_by/acknowledged_at yazar — hedefle karşılaştırma raporunun temeli", async () => {
    const service = serviceRoleClient();
    const { client: guest, tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);
    openGuestSessionIds.add(tableSessionId);

    const { error: callError } = await guest.rpc("call_waiter", { p_note: "Su istiyorum" });
    expect(callError).toBeNull();

    const { data: openCall } = await service
      .from("waiter_calls")
      .select("id")
      .eq("table_session_id", tableSessionId)
      .eq("status", "open")
      .single();

    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error: ackError } = await owner.rpc("acknowledge_waiter_call", { p_call_id: openCall!.id });
    expect(ackError).toBeNull();

    const { data: resolvedCall } = await service
      .from("waiter_calls")
      .select("status, acknowledged_by, acknowledged_at")
      .eq("id", openCall!.id)
      .single();
    expect(resolvedCall?.status).toBe("acknowledged");
    expect(resolvedCall?.acknowledged_by).not.toBeNull();
    expect(resolvedCall?.acknowledged_at).not.toBeNull();
  });
});
