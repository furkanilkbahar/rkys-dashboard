import "server-only";

import type { ModuleKey } from "@/lib/modules/keys";
import { createClient } from "@/lib/supabase/server";

export type Plan = {
  id: string;
  key: string;
  name: string;
  priceMinor: number;
  /**
   * D96 vitrin bayrağı. Liste FİLTRELENMEZ (aşağıdaki nota bakın) ama
   * çağıranın "hangisi varsayılan seçili gelmeli" sorusunu cevaplayabilmesi
   * için taşınır — kayıt formu buna bakıp Demo gibi iç planları varsayılan
   * yapmaz (D101).
   */
  isPublic: boolean;
};

// plans herkese açık okunur (marketing fiyatlandırma tablosu, Adım 6) —
// request-scoped client burada da yeterli, service-role'e gerek yok.
//
// BİLEREK FİLTRESİZ (D96): burası kayıt formunun ve plan atamasının kaynağı,
// yani "hangi planlar SEÇİLEBİLİR" sorusunun cevabı. `is_public` yalnızca
// "hangi planlar VİTRİNDE" sorusunu cevaplar ve orada — getMarketingPlans —
// uygulanır. Demo planının kayıt formunda kalıp ana sayfada görünmemesi tam
// olarak bu ayrımdan geliyor.
export async function getPlans(): Promise<Plan[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plans")
    .select("id, key, name, price_minor, is_public")
    .order("table_limit", { ascending: true, nullsFirst: false });

  return (data ?? []).map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    priceMinor: p.price_minor,
    isPublic: p.is_public,
  }));
}

export type MarketingPlan = Plan & {
  tableLimit: number | null;
  includedBranchCount: number;
  extraBranchPriceMinor: number;
  moduleKeys: ModuleKey[];
};

// Faz 13 Adım 0: pazarlama ana sayfasının fiyatlandırma bölümü — plans +
// plan_modules ikisi de herkese açık okunur (0038/0073), listPlatformPlans
// (src/lib/data/platformPlans.ts) ile aynı join deseninin service-role
// gerektirmeyen halka-açık hali.
//
// `is_public` filtresi (D96): Süper Admin'den açılan demo/iç planlar vitrine
// düşmez. Filtre SORGUDA, çağıranda değil — ana sayfa dışında bir yerin de
// vitrin listesine ihtiyacı olursa (ör. fiyat karşılaştırma sayfası) kuralı
// tekrar yazmak zorunda kalmasın.
//
// GERİ DÜŞÜŞ (D99, üretimde ölçülerek eklendi): migration ile uygulama
// dağıtımı arasındaki pencerede `is_public` kolonu HENÜZ YOKTUR; o anda
// PostgREST filtreyi reddediyor ve `data` null dönüyordu. Hata okunmadığı
// için sonuç sessizce boş liste oluyordu ve ANA SAYFANIN FİYAT TABLOSU
// TAMAMEN BOŞALIYORDU — 2026-08-06'da üretimde tam olarak bu oldu. Bir
// vitrin filtresinin başarısızlığı, ürünün fiyatlarının kaybolmasına
// dönüşmemeli: filtre uygulanamıyorsa filtresiz liste gösterilir (fazla
// plan göstermek, hiç plan göstermemekten iyidir) ve durum log'lanır.
export async function getMarketingPlans(): Promise<MarketingPlan[]> {
  const supabase = await createClient();
  const columns = "id, key, name, price_minor, table_limit, included_branch_count, extra_branch_price_minor";

  const [visible, { data: planModules }] = await Promise.all([
    supabase.from("plans").select(columns).eq("is_public", true).order("price_minor"),
    supabase.from("plan_modules").select("plan_id, module_key"),
  ]);

  let plans = visible.data;
  if (visible.error) {
    console.error("getMarketingPlans: is_public filtresi uygulanamadı, filtresiz listeye düşülüyor", visible.error);
    const { data: allPlans } = await supabase.from("plans").select(columns).order("price_minor");
    plans = allPlans;
  }

  const moduleKeysByPlan = new Map<string, ModuleKey[]>();
  for (const row of planModules ?? []) {
    const list = moduleKeysByPlan.get(row.plan_id) ?? [];
    list.push(row.module_key as ModuleKey);
    moduleKeysByPlan.set(row.plan_id, list);
  }

  return (plans ?? []).map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    priceMinor: p.price_minor,
    // Sabit `true`: bu fonksiyonun dönüşü VİTRİNİN KENDİSİ, yani buradaki her
    // satır tanımı gereği vitrinde. `is_public` bilerek SELECT'e eklenmedi —
    // eklenseydi yukarıdaki D99 geri düşüşü de aynı eksik kolona takılır ve
    // ana sayfanın fiyat tablosunu boşaltan hata geri gelirdi.
    isPublic: true,
    tableLimit: p.table_limit,
    includedBranchCount: p.included_branch_count,
    extraBranchPriceMinor: p.extra_branch_price_minor,
    moduleKeys: moduleKeysByPlan.get(p.id) ?? [],
  }));
}
