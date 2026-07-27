import { afterAll, describe, expect, it } from "vitest";

import { bootstrapGuestForTable, createPlatformAdmin, createThrowawayTenant, SEED, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const createdUserIds = new Set<string>();
const createdTenantIds = new Set<string>();
let openedGuestSessionId: string | null = null;

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of createdUserIds) {
    await service.auth.admin.deleteUser(id);
  }
  for (const id of createdTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
  if (openedGuestSessionId) {
    await service.from("table_sessions").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", openedGuestSessionId);
  }
});

describe("request_module RPC (Faz 4 revizyonu Adım 6, S55)", () => {
  it("misafir çağıramaz", async () => {
    const { client: guest, tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);
    openedGuestSessionId = tableSessionId;

    const { error } = await guest.rpc("request_module", { p_module_key: "kiosk" });
    expect(error).not.toBeNull();
  });

  it("staff kendi tenant'ı için pending bir talep oluşturur", async () => {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant("request-module");
    createdTenantIds.add(throwaway.tenantId);
    const owner = await signInAsSeededOwner(throwaway.email);

    const { error } = await owner.rpc("request_module", { p_module_key: "kiosk" });
    expect(error).toBeNull();

    const { data: request } = await service
      .from("module_requests")
      .select("status, tenant_id")
      .eq("tenant_id", throwaway.tenantId)
      .eq("module_key", "kiosk")
      .single();
    expect(request?.status).toBe("pending");
    expect(request?.tenant_id).toBe(throwaway.tenantId);
  });

  it("aynı modül için ikinci bir pending talep oluşturulamaz (kısmi unique index)", async () => {
    const throwaway = await createThrowawayTenant("request-module-dup");
    createdTenantIds.add(throwaway.tenantId);
    const owner = await signInAsSeededOwner(throwaway.email);

    const first = await owner.rpc("request_module", { p_module_key: "marketplace" });
    expect(first.error).toBeNull();

    const second = await owner.rpc("request_module", { p_module_key: "marketplace" });
    expect(second.error).not.toBeNull();
  });
});

describe("resolve_module_request RPC (Faz 4 revizyonu Adım 6, S55)", () => {
  it("yalnızca platform_admin çağırabilir", async () => {
    const throwaway = await createThrowawayTenant("resolve-request-forbidden");
    createdTenantIds.add(throwaway.tenantId);
    const owner = await signInAsSeededOwner(throwaway.email);
    await owner.rpc("request_module", { p_module_key: "kiosk" });

    const service = serviceRoleClient();
    const { data: request } = await service
      .from("module_requests")
      .select("id")
      .eq("tenant_id", throwaway.tenantId)
      .eq("module_key", "kiosk")
      .single();

    const { error } = await owner.rpc("resolve_module_request", { p_request_id: request!.id, p_approve: true });
    expect(error).not.toBeNull();
  });

  it("onaylanırsa tenant_modules upsert edilir (source='granted'), talep 'approved' olur", async () => {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant("resolve-request-approve");
    createdTenantIds.add(throwaway.tenantId);
    const owner = await signInAsSeededOwner(throwaway.email);
    await owner.rpc("request_module", { p_module_key: "kiosk" });

    const { data: request } = await service
      .from("module_requests")
      .select("id")
      .eq("tenant_id", throwaway.tenantId)
      .eq("module_key", "kiosk")
      .single();

    const admin = await createPlatformAdmin("resolve-request-approve");
    createdUserIds.add(admin.userId);
    const { error } = await admin.client.rpc("resolve_module_request", { p_request_id: request!.id, p_approve: true });
    expect(error).toBeNull();

    const { data: updatedRequest } = await service.from("module_requests").select("status, resolved_at").eq("id", request!.id).single();
    expect(updatedRequest?.status).toBe("approved");
    expect(updatedRequest?.resolved_at).not.toBeNull();

    const { data: moduleRow } = await service
      .from("tenant_modules")
      .select("is_enabled, source")
      .eq("tenant_id", throwaway.tenantId)
      .eq("module_key", "kiosk")
      .single();
    expect(moduleRow?.is_enabled).toBe(true);
    expect(moduleRow?.source).toBe("granted");
  });

  it("reddedilirse talep 'rejected' olur, tenant_modules'a hiç dokunulmaz", async () => {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant("resolve-request-reject");
    createdTenantIds.add(throwaway.tenantId);
    const owner = await signInAsSeededOwner(throwaway.email);
    await owner.rpc("request_module", { p_module_key: "kiosk" });

    const { data: request } = await service
      .from("module_requests")
      .select("id")
      .eq("tenant_id", throwaway.tenantId)
      .eq("module_key", "kiosk")
      .single();

    const admin = await createPlatformAdmin("resolve-request-reject");
    createdUserIds.add(admin.userId);
    const { error } = await admin.client.rpc("resolve_module_request", { p_request_id: request!.id, p_approve: false });
    expect(error).toBeNull();

    const { data: updatedRequest } = await service.from("module_requests").select("status").eq("id", request!.id).single();
    expect(updatedRequest?.status).toBe("rejected");

    const { data: moduleRow } = await service
      .from("tenant_modules")
      .select("id")
      .eq("tenant_id", throwaway.tenantId)
      .eq("module_key", "kiosk")
      .maybeSingle();
    expect(moduleRow).toBeNull();
  });

  it("zaten karara bağlanmış bir talep tekrar çözülemez", async () => {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant("resolve-request-twice");
    createdTenantIds.add(throwaway.tenantId);
    const owner = await signInAsSeededOwner(throwaway.email);
    await owner.rpc("request_module", { p_module_key: "kiosk" });

    const { data: request } = await service
      .from("module_requests")
      .select("id")
      .eq("tenant_id", throwaway.tenantId)
      .eq("module_key", "kiosk")
      .single();

    const admin = await createPlatformAdmin("resolve-request-twice");
    createdUserIds.add(admin.userId);
    await admin.client.rpc("resolve_module_request", { p_request_id: request!.id, p_approve: true });

    const { error } = await admin.client.rpc("resolve_module_request", { p_request_id: request!.id, p_approve: false });
    expect(error).not.toBeNull();
  });

  it("bilinmeyen talep id'si için hata verir", async () => {
    const admin = await createPlatformAdmin("resolve-request-unknown");
    createdUserIds.add(admin.userId);
    const { error } = await admin.client.rpc("resolve_module_request", { p_request_id: crypto.randomUUID(), p_approve: true });
    expect(error).not.toBeNull();
  });
});
