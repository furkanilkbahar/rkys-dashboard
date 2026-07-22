import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";
import type { LicenseType } from "@/lib/licensing/types";

export type PlatformLicense = {
  id: string;
  tenantId: string;
  tenantName: string;
  licenseType: LicenseType;
  licenseKey: string;
  issuedAt: string;
  expiresAt: string | null;
};

// requirePlatformAdmin() zaten sayfa seviyesinde gate yapıyor; platformTenants.ts
// ile aynı gerekçeyle service-role kullanılıyor (tenant-sınırı-aşan okuma).
export async function getPlatformLicenses(): Promise<PlatformLicense[]> {
  const service = createServiceRoleClient();
  const { data } = await service
    .from("licenses")
    .select("id, tenant_id, license_type, license_key, issued_at, expires_at, tenants(name)")
    .order("issued_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    tenantName: row.tenants?.name ?? row.tenant_id,
    licenseType: row.license_type as LicenseType,
    licenseKey: row.license_key,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
  }));
}
