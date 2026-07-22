import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

export type PlatformTenant = {
  id: string;
  slug: string;
  name: string;
  status: "active" | "suspended";
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
  status: "active" | "suspended";
  branches: { id: string; name: string; isDefault: boolean }[];
  enabledModules: string[];
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
    status: t.status as "active" | "suspended",
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
  const [{ data: tenant }, { data: branches }, { data: modules }] = await Promise.all([
    service.from("tenants").select("id, slug, name, status").eq("id", tenantId).single(),
    service.from("branches").select("id, name, is_default").eq("tenant_id", tenantId),
    service.from("tenant_modules").select("module_key").eq("tenant_id", tenantId).eq("is_enabled", true),
  ]);

  if (!tenant) {
    return null;
  }

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    status: tenant.status as "active" | "suspended",
    branches: (branches ?? []).map((b) => ({ id: b.id, name: b.name, isDefault: b.is_default })),
    enabledModules: (modules ?? []).map((m) => m.module_key),
  };
}
