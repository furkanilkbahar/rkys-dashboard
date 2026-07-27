import "server-only";

import type { ModuleKey } from "@/lib/modules/keys";
import { MODULE_KEYS } from "@/lib/modules/keys";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type PlatformTenantStatus = "active" | "suspended" | "pending_approval" | "rejected";
export type TenantModuleSource = "plan" | "paid_addon" | "granted";

export type PlatformTenantModule = {
  moduleKey: ModuleKey;
  isEnabled: boolean;
  source: TenantModuleSource;
  pendingRemovalSince: string | null;
};

export type PlatformTenant = {
  id: string;
  slug: string;
  name: string;
  status: PlatformTenantStatus;
  createdAt: string;
  branchCount: number;
};

export type PlatformStats = {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalBranches: number;
  totalTables: number;
};

export type PlatformTenantDetail = {
  id: string;
  slug: string;
  name: string;
  status: PlatformTenantStatus;
  planId: string | null;
  branches: { id: string; name: string; isDefault: boolean }[];
  modules: PlatformTenantModule[];
  subscription: {
    status: "trialing" | "active" | "past_due" | "canceled";
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
  } | null;
};

export type PlatformPlan = {
  id: string;
  key: string;
  name: string;
};

export type PendingTenant = {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
  planName: string | null;
  subscriptionStatus: "trialing" | "active" | "past_due" | "canceled" | null;
};

// Süper Admin salt-okunur görünümleri: gate zaten Next.js layer'ında
// requirePlatformAdmin() ile yapılıyor, bu yüzden burada her tenant-scoped
// tabloya ayrı bir is_platform_admin() RLS bypass politikası eklemek yerine
// (geniş kapsamlı, riskli bir değişiklik) service-role client kullanılıyor —
// masa/t/[rawToken]/route.ts'nin tenant-sınırı-aşan okumaları ile aynı desen.
export async function getPlatformTenants(): Promise<PlatformTenant[]> {
  const service = createServiceRoleClient();
  const [{ data: tenants }, { data: branches }] = await Promise.all([
    service.from("tenants").select("id, slug, name, status, created_at").order("created_at"),
    service.from("branches").select("tenant_id"),
  ]);

  const branchCountByTenant = new Map<string, number>();
  for (const row of branches ?? []) {
    branchCountByTenant.set(row.tenant_id, (branchCountByTenant.get(row.tenant_id) ?? 0) + 1);
  }

  return (tenants ?? []).map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    status: t.status as PlatformTenantStatus,
    createdAt: t.created_at,
    branchCount: branchCountByTenant.get(t.id) ?? 0,
  }));
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const service = createServiceRoleClient();
  const [{ data: tenants }, { count: totalBranches }, { count: totalTables }] = await Promise.all([
    service.from("tenants").select("status"),
    service.from("branches").select("*", { count: "exact", head: true }),
    service.from("tables").select("*", { count: "exact", head: true }),
  ]);

  const activeTenants = (tenants ?? []).filter((t) => t.status === "active").length;

  return {
    totalTenants: tenants?.length ?? 0,
    activeTenants,
    suspendedTenants: (tenants?.length ?? 0) - activeTenants,
    totalBranches: totalBranches ?? 0,
    totalTables: totalTables ?? 0,
  };
}

export async function getPlatformTenantDetail(tenantId: string): Promise<PlatformTenantDetail | null> {
  const service = createServiceRoleClient();
  const [{ data: tenant }, { data: branches }, { data: modules }, { data: subscription }] = await Promise.all([
    service.from("tenants").select("id, slug, name, status, plan_id").eq("id", tenantId).single(),
    service.from("branches").select("id, name, is_default").eq("tenant_id", tenantId),
    service.from("tenant_modules").select("module_key, is_enabled, source, pending_removal_since").eq("tenant_id", tenantId),
    service.from("subscriptions").select("status, trial_ends_at, current_period_end").eq("tenant_id", tenantId).maybeSingle(),
  ]);

  if (!tenant) {
    return null;
  }

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    status: tenant.status as PlatformTenantStatus,
    planId: tenant.plan_id,
    branches: (branches ?? []).map((b) => ({ id: b.id, name: b.name, isDefault: b.is_default })),
    modules: MODULE_KEYS.map((moduleKey) => {
      const row = (modules ?? []).find((m) => m.module_key === moduleKey);
      return {
        moduleKey,
        isEnabled: row?.is_enabled ?? false,
        source: (row?.source as TenantModuleSource) ?? "granted",
        pendingRemovalSince: row?.pending_removal_since ?? null,
      };
    }),
    subscription: subscription
      ? {
          status: subscription.status as "trialing" | "active" | "past_due" | "canceled",
          trialEndsAt: subscription.trial_ends_at,
          currentPeriodEnd: subscription.current_period_end,
        }
      : null,
  };
}

export async function getPlatformPlans(): Promise<PlatformPlan[]> {
  const service = createServiceRoleClient();
  const { data } = await service.from("plans").select("id, key, name").order("table_limit", { ascending: true, nullsFirst: false });

  return (data ?? []).map((p) => ({ id: p.id, key: p.key, name: p.name }));
}

// Onay kuyruğu (/platform/pending-tenants, Faz 4 revizyonu Adım 2): kayıt
// formundan gelmiş, henüz onaylanmamış tenant'lar — plan adı ve ödeme
// durumu platform adminin karar vermesi için gösteriliyor.
export async function getPendingTenants(): Promise<PendingTenant[]> {
  const service = createServiceRoleClient();
  const { data: tenants } = await service
    .from("tenants")
    .select("id, slug, name, created_at, plan_id")
    .eq("status", "pending_approval")
    .order("created_at");

  if (!tenants || tenants.length === 0) {
    return [];
  }

  const tenantIds = tenants.map((t) => t.id);
  const planIds = [...new Set(tenants.map((t) => t.plan_id).filter((id): id is string => id !== null))];

  const [{ data: plans }, { data: subscriptions }] = await Promise.all([
    planIds.length > 0 ? service.from("plans").select("id, name").in("id", planIds) : Promise.resolve({ data: [] }),
    service.from("subscriptions").select("tenant_id, status").in("tenant_id", tenantIds),
  ]);

  const planNameById = new Map((plans ?? []).map((p) => [p.id, p.name]));
  const subscriptionStatusByTenant = new Map((subscriptions ?? []).map((s) => [s.tenant_id, s.status]));

  return tenants.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    createdAt: t.created_at,
    planName: t.plan_id ? (planNameById.get(t.plan_id) ?? null) : null,
    subscriptionStatus:
      (subscriptionStatusByTenant.get(t.id) as "trialing" | "active" | "past_due" | "canceled" | undefined) ?? null,
  }));
}
