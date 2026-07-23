import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AdminSupplier = { id: string; name: string; contactInfo: string | null; isActive: boolean };

export async function getAdminSuppliers(tenantId: string): Promise<AdminSupplier[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("suppliers").select("id, name, contact_info, is_active").eq("tenant_id", tenantId).order("name");

  return (data ?? []).map((s) => ({ id: s.id, name: s.name, contactInfo: s.contact_info, isActive: s.is_active }));
}
