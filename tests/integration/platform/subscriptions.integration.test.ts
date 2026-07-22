import { afterAll, describe, expect, it } from "vitest";

import { bootstrapGuestForTable, createThrowawayTenant, SEED, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const createdTenantIds = new Set<string>();
let openedGuestSessionId: string | null = null;

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of createdTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
  if (openedGuestSessionId) {
    await service.from("table_sessions").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", openedGuestSessionId);
  }
});

describe("trial otomatik oluşturma + is_subscription_active (Faz 4 Adım 3, S13, D18)", () => {
  it("yeni tenant otomatik 14 günlük trialing abonelikle başlar", async () => {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant("trial-auto");
    createdTenantIds.add(throwaway.tenantId);

    const { data: subscription } = await service
      .from("subscriptions")
      .select("status, trial_ends_at")
      .eq("tenant_id", throwaway.tenantId)
      .single();

    expect(subscription?.status).toBe("trialing");
    const daysUntilExpiry = (new Date(subscription!.trial_ends_at!).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(daysUntilExpiry).toBeGreaterThan(13);
    expect(daysUntilExpiry).toBeLessThanOrEqual(14);
  });

  it("trial süresi dolmamış tenant için is_subscription_active true döner", async () => {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant("trial-valid");
    createdTenantIds.add(throwaway.tenantId);

    const { data } = await service.rpc("is_subscription_active", { p_tenant_id: throwaway.tenantId });
    expect(data).toBe(true);
  });

  it("trial süresi dolmuş ve abonelik aktif değilse is_subscription_active false döner", async () => {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant("trial-expired");
    createdTenantIds.add(throwaway.tenantId);

    await service
      .from("subscriptions")
      .update({ trial_ends_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() })
      .eq("tenant_id", throwaway.tenantId);

    const { data } = await service.rpc("is_subscription_active", { p_tenant_id: throwaway.tenantId });
    expect(data).toBe(false);
  });

  it("status='active' ise trial_ends_at'e bakılmaksızın is_subscription_active true döner", async () => {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant("trial-active-status");
    createdTenantIds.add(throwaway.tenantId);

    await service
      .from("subscriptions")
      .update({ status: "active", trial_ends_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() })
      .eq("tenant_id", throwaway.tenantId);

    const { data } = await service.rpc("is_subscription_active", { p_tenant_id: throwaway.tenantId });
    expect(data).toBe(true);
  });
});

describe("abonelik checkout → webhook aktivasyon akışı (mock-first, RPC seviyesi)", () => {
  it("set_subscription_checkout_ref + activate_subscription ile abonelik aktifleşir, idempotenttir", async () => {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant("checkout-flow");
    createdTenantIds.add(throwaway.tenantId);
    const owner = await signInAsSeededOwner(throwaway.email);

    const providerRef = crypto.randomUUID();
    const { error: refError } = await owner.rpc("set_subscription_checkout_ref", {
      p_provider: "mock",
      p_provider_ref: providerRef,
    });
    expect(refError).toBeNull();

    const { data: pending } = await service
      .from("subscriptions")
      .select("status, provider, provider_ref")
      .eq("tenant_id", throwaway.tenantId)
      .single();
    expect(pending?.status).toBe("trialing");
    expect(pending?.provider).toBe("mock");
    expect(pending?.provider_ref).toBe(providerRef);

    const { error: activateError } = await service.rpc("activate_subscription", {
      p_provider: "mock",
      p_provider_ref: providerRef,
    });
    expect(activateError).toBeNull();

    const { data: active } = await service
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("tenant_id", throwaway.tenantId)
      .single();
    expect(active?.status).toBe("active");
    expect(active?.current_period_end).not.toBeNull();

    // İkinci kez aynı provider_ref ile gelen webhook (retry) no-op olmalı.
    const { error: retryError } = await service.rpc("activate_subscription", {
      p_provider: "mock",
      p_provider_ref: providerRef,
    });
    expect(retryError).toBeNull();
  });

  it("bilinmeyen provider_ref için activate_subscription hata verir", async () => {
    const service = serviceRoleClient();
    const { error } = await service.rpc("activate_subscription", {
      p_provider: "mock",
      p_provider_ref: crypto.randomUUID(),
    });
    expect(error).not.toBeNull();
  });

  it("set_subscription_checkout_ref misafir tarafından çağrılamaz", async () => {
    const { client: guest, tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);
    openedGuestSessionId = tableSessionId;

    const { error } = await guest.rpc("set_subscription_checkout_ref", {
      p_provider: "mock",
      p_provider_ref: crypto.randomUUID(),
    });
    expect(error).not.toBeNull();
  });
});

describe("cancel_subscription RPC (Faz 4 Adım 3)", () => {
  it("yalnızca owner iptal edebilir", async () => {
    const throwaway = await createThrowawayTenant("cancel-forbidden");
    createdTenantIds.add(throwaway.tenantId);
    const service = serviceRoleClient();

    // waiter rolünde bir personel oluşturup deniyoruz.
    const email = `waiter-${crypto.randomUUID().slice(0, 8)}@test-throwaway.test`;
    const { data: authUser } = await service.auth.admin.createUser({ email, password: SEED.password, email_confirm: true });
    await service.from("profiles").insert({ id: authUser!.user!.id, tenant_id: throwaway.tenantId, role: "waiter", is_active: true });
    const waiter = await signInAsSeededOwner(email);

    const { error } = await waiter.rpc("cancel_subscription");
    expect(error).not.toBeNull();

    const { data: subscription } = await service
      .from("subscriptions")
      .select("status")
      .eq("tenant_id", throwaway.tenantId)
      .single();
    expect(subscription?.status).toBe("trialing");
  });

  it("owner aboneliği iptal edebilir, is_subscription_active false döner", async () => {
    const throwaway = await createThrowawayTenant("cancel-happy");
    createdTenantIds.add(throwaway.tenantId);
    const service = serviceRoleClient();
    await service.from("subscriptions").update({ status: "active" }).eq("tenant_id", throwaway.tenantId);

    const owner = await signInAsSeededOwner(throwaway.email);
    const { error } = await owner.rpc("cancel_subscription");
    expect(error).toBeNull();

    const { data: isActive } = await service.rpc("is_subscription_active", { p_tenant_id: throwaway.tenantId });
    expect(isActive).toBe(false);
  });
});

describe("subscriptions RLS (Faz 4 Adım 3)", () => {
  it("personel yalnızca kendi tenant'ının aboneliğini görebilir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await owner.from("subscriptions").select("tenant_id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].tenant_id).toBe(SEED.acme.tenantId);
  });
});
