import { afterEach, describe, expect, it } from "vitest";

import { SEED, bootstrapGuestForTable, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

afterEach(async () => {
  await serviceRoleClient()
    .from("table_sessions")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("table_id", SEED.acme.table1Id)
    .eq("status", "active");
});

describe("call_waiter", () => {
  it("misafir tipsiz tek dokunuş çağrı oluşturabilir (D35)", async () => {
    const { client } = await bootstrapGuestForTable(SEED.acme.table1Id);

    const { data, error } = await client.rpc("call_waiter", {});
    expect(error).toBeNull();
    expect(data).toBeTruthy();

    const { data: call } = await serviceRoleClient().from("waiter_calls").select("call_type_id, status").eq("id", data as string).single();
    expect(call?.call_type_id).toBeNull();
    expect(call?.status).toBe("open");
  });

  it("misafir tipli çağrı oluşturabilir", async () => {
    const { client } = await bootstrapGuestForTable(SEED.acme.table1Id);

    const { data, error } = await client.rpc("call_waiter", { p_call_type_key: "check" });
    expect(error).toBeNull();

    const { data: call } = await serviceRoleClient()
      .from("waiter_calls")
      .select("call_type_id")
      .eq("id", data as string)
      .single();
    expect(call?.call_type_id).not.toBeNull();
  });

  it("geçersiz çağrı tipi reddedilir", async () => {
    const { client } = await bootstrapGuestForTable(SEED.acme.table1Id);

    const { error } = await client.rpc("call_waiter", { p_call_type_key: "does-not-exist" });
    expect(error).not.toBeNull();
  });

  it("15 saniye içinde ikinci çağrı reddedilir (RULES #8)", async () => {
    const { client } = await bootstrapGuestForTable(SEED.acme.table1Id);

    const first = await client.rpc("call_waiter", {});
    expect(first.error).toBeNull();

    const second = await client.rpc("call_waiter", {});
    expect(second.error).not.toBeNull();
    expect(second.error?.message).toContain("RATE_LIMITED");
  });

  it("personel call_waiter çağıramaz", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await owner.rpc("call_waiter", {});
    expect(error).not.toBeNull();
  });
});

describe("acknowledge_waiter_call", () => {
  it("personel açık çağrıyı karşılayabilir", async () => {
    const { client } = await bootstrapGuestForTable(SEED.acme.table1Id);
    const { data: callId } = await client.rpc("call_waiter", {});
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);

    const { error } = await owner.rpc("acknowledge_waiter_call", { p_call_id: callId as string });
    expect(error).toBeNull();

    const { data: call } = await serviceRoleClient()
      .from("waiter_calls")
      .select("status, acknowledged_by")
      .eq("id", callId as string)
      .single();
    expect(call?.status).toBe("acknowledged");
    expect(call?.acknowledged_by).not.toBeNull();
  });

  it("misafir kendi çağrısını karşılayamaz", async () => {
    const { client } = await bootstrapGuestForTable(SEED.acme.table1Id);
    const { data: callId } = await client.rpc("call_waiter", {});

    const { error } = await client.rpc("acknowledge_waiter_call", { p_call_id: callId as string });
    expect(error).not.toBeNull();
  });

  it("zaten karşılanmış çağrı tekrar karşılanamaz", async () => {
    const { client } = await bootstrapGuestForTable(SEED.acme.table1Id);
    const { data: callId } = await client.rpc("call_waiter", {});
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    await owner.rpc("acknowledge_waiter_call", { p_call_id: callId as string });

    const { error } = await owner.rpc("acknowledge_waiter_call", { p_call_id: callId as string });
    expect(error).not.toBeNull();
  });
});
