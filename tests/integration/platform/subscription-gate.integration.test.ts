import { afterAll, describe, expect, it } from "vitest";

import {
  anonClient,
  createPlatformAdmin,
  createThrowawayTenant,
  serviceRoleClient,
  signInAsSeededOwner,
} from "../../helpers/testClients";

/**
 * D101: kayıtta ödeme kalktı, karşılığında trial'ın BİTİŞİ bir sonuç doğurmaya
 * başladı. Bu dosya o kapının iki ucunu doğrular:
 *   - resolve_tenant_by_domain'in subscription_active'i (proxy'nin okuduğu alan)
 *   - mark_subscription_paid / approve_tenant_on_registration
 */
const createdTenantIds = new Set<string>();
const createdUserIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of createdTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
  for (const id of createdUserIds) {
    await service.auth.admin.deleteUser(id);
  }
  await service.from("platform_settings").update({ auto_approve_registrations: false }).eq("id", true);
});

async function domainOf(tenantId: string) {
  const { data } = await serviceRoleClient()
    .from("tenant_domains")
    .select("domain")
    .eq("tenant_id", tenantId)
    .eq("is_primary", true)
    .single();
  return data!.domain as string;
}

async function resolveByDomain(domain: string) {
  const { data } = await anonClient().rpc("resolve_tenant_by_domain", { p_domain: domain });
  return data?.[0];
}

async function expireTrial(tenantId: string) {
  await serviceRoleClient()
    .from("subscriptions")
    .update({ status: "trialing", trial_ends_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("tenant_id", tenantId);
}

describe("abonelik kapısı — resolve_tenant_by_domain.subscription_active (D101)", () => {
  it("trial sürerken subscription_active true döner (proxy tenant'ı açar)", async () => {
    const throwaway = await createThrowawayTenant("gate-trialing");
    createdTenantIds.add(throwaway.tenantId);

    const resolved = await resolveByDomain(await domainOf(throwaway.tenantId));
    expect(resolved?.tenant_status).toBe("active");
    expect(resolved?.subscription_active).toBe(true);
  });

  it("trial dolduğunda subscription_active false döner — ZAMANLANMIŞ GÖREV OLMADAN", async () => {
    const throwaway = await createThrowawayTenant("gate-expired");
    createdTenantIds.add(throwaway.tenantId);
    await expireTrial(throwaway.tenantId);

    const resolved = await resolveByDomain(await domainOf(throwaway.tenantId));
    // tenant.status'a DOKUNULMADI: pasiflik türetiliyor, saklanmıyor. Kapının
    // kapanması için hiçbir job'ın çalışmış olması gerekmiyor.
    expect(resolved?.tenant_status).toBe("active");
    expect(resolved?.subscription_active).toBe(false);
  });

  it("abonelik iptal edildiğinde de kapı kapanır", async () => {
    const throwaway = await createThrowawayTenant("gate-canceled");
    createdTenantIds.add(throwaway.tenantId);
    await serviceRoleClient().from("subscriptions").update({ status: "canceled" }).eq("tenant_id", throwaway.tenantId);

    const resolved = await resolveByDomain(await domainOf(throwaway.tenantId));
    expect(resolved?.subscription_active).toBe(false);
  });

  it("ödeme yapıldığı anda kapı yeniden açılır (job beklenmez)", async () => {
    const throwaway = await createThrowawayTenant("gate-reopen");
    createdTenantIds.add(throwaway.tenantId);
    await expireTrial(throwaway.tenantId);
    expect((await resolveByDomain(await domainOf(throwaway.tenantId)))?.subscription_active).toBe(false);

    await serviceRoleClient()
      .from("subscriptions")
      .update({ status: "active", current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString() })
      .eq("tenant_id", throwaway.tenantId);

    expect((await resolveByDomain(await domainOf(throwaway.tenantId)))?.subscription_active).toBe(true);
  });
});

describe("mark_subscription_paid (D101)", () => {
  it("platform admin trial'ı dolmuş tenant'ı 30 günlüğüne pasiflikten çıkarır", async () => {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant("markpaid-ok");
    createdTenantIds.add(throwaway.tenantId);
    await expireTrial(throwaway.tenantId);

    const admin = await createPlatformAdmin("markpaid");
    createdUserIds.add(admin.userId);

    const { error } = await admin.client.rpc("mark_subscription_paid", {
      p_tenant_id: throwaway.tenantId,
      p_period_days: 30,
    });
    expect(error).toBeNull();

    const { data: subscription } = await service
      .from("subscriptions")
      .select("status, provider, current_period_end")
      .eq("tenant_id", throwaway.tenantId)
      .single();
    expect(subscription?.status).toBe("active");
    expect(subscription?.provider).toBe("manual");

    const daysLeft = Math.round((new Date(subscription!.current_period_end!).getTime() - Date.now()) / 86_400_000);
    expect(daysLeft).toBe(30);

    expect((await resolveByDomain(await domainOf(throwaway.tenantId)))?.subscription_active).toBe(true);
  });

  it("onay bekleyen tenant'ı aynı anda açar ve planının modüllerini seed eder", async () => {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant("markpaid-pending");
    createdTenantIds.add(throwaway.tenantId);

    const { data: starterPlan } = await service.from("plans").select("id").eq("key", "starter").single();
    await service
      .from("tenants")
      .update({ status: "pending_approval", plan_id: starterPlan!.id })
      .eq("id", throwaway.tenantId);

    const admin = await createPlatformAdmin("markpaid-pending");
    createdUserIds.add(admin.userId);

    const { error } = await admin.client.rpc("mark_subscription_paid", {
      p_tenant_id: throwaway.tenantId,
      p_period_days: 30,
    });
    expect(error).toBeNull();

    const { data: tenant } = await service.from("tenants").select("status").eq("id", throwaway.tenantId).single();
    expect(tenant?.status).toBe("active");

    const { data: modules } = await service
      .from("tenant_modules")
      .select("module_key, is_enabled, source")
      .eq("tenant_id", throwaway.tenantId);
    expect(modules!.map((m) => m.module_key).sort()).toEqual(["inventory", "pos_cash"]);
    expect(modules!.every((m) => m.is_enabled && m.source === "plan")).toBe(true);
  });

  it("platform admin olmayan bir owner çağıramaz (RLS/yetki)", async () => {
    const throwaway = await createThrowawayTenant("markpaid-forbidden");
    createdTenantIds.add(throwaway.tenantId);
    const ownerClient = await signInAsSeededOwner(throwaway.email);

    const { error } = await ownerClient.rpc("mark_subscription_paid", {
      p_tenant_id: throwaway.tenantId,
      p_period_days: 30,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("platform admin only");
  });

  it("kendi tenant'ını bile ödemiş gibi işaretleyemez — bedava uzatma kapalı", async () => {
    const service = serviceRoleClient();
    const throwaway = await createThrowawayTenant("markpaid-self");
    createdTenantIds.add(throwaway.tenantId);
    await expireTrial(throwaway.tenantId);
    const ownerClient = await signInAsSeededOwner(throwaway.email);

    await ownerClient.rpc("mark_subscription_paid", {
      p_tenant_id: throwaway.tenantId,
      p_period_days: 3650,
    });

    const { data: subscription } = await service
      .from("subscriptions")
      .select("status")
      .eq("tenant_id", throwaway.tenantId)
      .single();
    expect(subscription?.status).toBe("trialing");
    expect((await resolveByDomain(await domainOf(throwaway.tenantId)))?.subscription_active).toBe(false);
  });
});

describe("approve_tenant_on_registration (D101 — otomatik onay ödemeden koptu)", () => {
  it("ayar AÇIKKEN kayıt anında onaylar ve modülleri seed eder", async () => {
    const service = serviceRoleClient();
    await service.from("platform_settings").update({ auto_approve_registrations: true }).eq("id", true);

    const throwaway = await createThrowawayTenant("autoapprove-on");
    createdTenantIds.add(throwaway.tenantId);
    const { data: starterPlan } = await service.from("plans").select("id").eq("key", "starter").single();
    await service
      .from("tenants")
      .update({ status: "pending_approval", plan_id: starterPlan!.id })
      .eq("id", throwaway.tenantId);

    const { data: approved } = await service.rpc("approve_tenant_on_registration", {
      p_tenant_id: throwaway.tenantId,
    });
    expect(approved).toBe(true);

    const { data: tenant } = await service.from("tenants").select("status").eq("id", throwaway.tenantId).single();
    expect(tenant?.status).toBe("active");

    const { data: modules } = await service.from("tenant_modules").select("module_key").eq("tenant_id", throwaway.tenantId);
    expect(modules!.map((m) => m.module_key).sort()).toEqual(["inventory", "pos_cash"]);

    await service.from("platform_settings").update({ auto_approve_registrations: false }).eq("id", true);
  });

  it("ayar KAPALIYKEN tenant onay kuyruğunda kalır, modül açılmaz", async () => {
    const service = serviceRoleClient();
    await service.from("platform_settings").update({ auto_approve_registrations: false }).eq("id", true);

    const throwaway = await createThrowawayTenant("autoapprove-off");
    createdTenantIds.add(throwaway.tenantId);
    const { data: starterPlan } = await service.from("plans").select("id").eq("key", "starter").single();
    await service
      .from("tenants")
      .update({ status: "pending_approval", plan_id: starterPlan!.id })
      .eq("id", throwaway.tenantId);

    const { data: approved } = await service.rpc("approve_tenant_on_registration", {
      p_tenant_id: throwaway.tenantId,
    });
    expect(approved).toBe(false);

    const { data: tenant } = await service.from("tenants").select("status").eq("id", throwaway.tenantId).single();
    expect(tenant?.status).toBe("pending_approval");

    const { data: modules } = await service.from("tenant_modules").select("module_key").eq("tenant_id", throwaway.tenantId);
    expect(modules).toHaveLength(0);
  });
});
