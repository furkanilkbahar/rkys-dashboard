import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AdminZone = {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
};

export type AdminTable = {
  id: string;
  label: string;
  zoneId: string | null;
  zoneName: string | null;
  isActive: boolean;
};

export type AdminGenericQr = {
  id: string;
  label: string;
  isActive: boolean;
};

export async function getAdminZones(tenantId: string, branchId: string): Promise<AdminZone[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("table_zones")
    .select("id, name, display_order, is_active")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .order("display_order");

  return (data ?? []).map((z) => ({
    id: z.id,
    name: z.name,
    displayOrder: z.display_order,
    isActive: z.is_active,
  }));
}

export async function getAdminTables(tenantId: string, branchId: string): Promise<AdminTable[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tables")
    .select("id, label, is_active, zone_id, table_zones(name)")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .order("label");

  return (data ?? []).map((t) => ({
    id: t.id,
    label: t.label,
    zoneId: t.zone_id,
    zoneName: t.table_zones?.name ?? null,
    isActive: t.is_active,
  }));
}

export async function getAdminGenericQrCodes(tenantId: string, branchId: string): Promise<AdminGenericQr[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("generic_qr_codes")
    .select("id, label, is_active")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .order("created_at");

  return (data ?? []).map((q) => ({ id: q.id, label: q.label, isActive: q.is_active }));
}
