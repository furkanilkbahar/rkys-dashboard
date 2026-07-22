import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * D39: tenant görünmez tek şubeyle başlar; çok şubeli seçici altyapısı
 * gelecek fazda UI'a çıkar. Faz 1'in personel yüzeyleri (garson/KDS)
 * şimdilik varsayılan şubeyi kullanır.
 */
export async function getDefaultBranchId(tenantId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("branches")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_default", true)
    .maybeSingle();

  return data?.id ?? null;
}

export type AdminBranch = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type AdminBranchesInfo = {
  branches: AdminBranch[];
  includedBranchCount: number;
};

// Faz 4 Adım 2: settings sayfasındaki "Şubeler" bölümü için — mevcut
// şubeler + planın ücretsiz dahil ettiği şube sayısı (aşımda UI "ek şube
// ücreti" bilgilendirmesi gösterir, bkz. create_branch RPC'si).
export async function getAdminBranchesInfo(tenantId: string): Promise<AdminBranchesInfo> {
  const supabase = await createClient();
  const [{ data: branches }, { data: tenant }] = await Promise.all([
    supabase.from("branches").select("id, name, is_default").eq("tenant_id", tenantId).order("created_at"),
    supabase.from("tenants").select("plans(included_branch_count)").eq("id", tenantId).single(),
  ]);

  return {
    branches: (branches ?? []).map((b) => ({ id: b.id, name: b.name, isDefault: b.is_default })),
    includedBranchCount: tenant?.plans?.included_branch_count ?? 1,
  };
}
