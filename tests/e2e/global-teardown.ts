import { serviceRoleClient, SEED } from "../helpers/testClients";

/**
 * Faz 23 Adım 4 — E2E paketinin acme'de bıraktığı artıkları temizler.
 *
 * NEDEN GEREKLİ (ölçüldü, 2026-08-04): paket acme'nin GERÇEK demo verisine
 * yazıyor ve çoğu spec bıraktığını toplamıyordu. Bir haftalık koşumun sonucu:
 * 60 masanın 47'si zaman damgalı çöp (`Test Masa 1785770908550`), mükerrer
 * "Salon" bölgeleri, KDS panosunda kalıcı olarak duran 5 açık sipariş.
 *
 * BUNUN SOMUT ZARARI VAR, kozmetik değil:
 *   - `menu-reorder.spec.ts` biriken kategoriler yüzünden kırılıyordu
 *     (çöp silinince aynı test 2.4 sn'de geçti),
 *   - `session-panel.spec.ts` 116 açık sipariş yüzünden kırılıyordu,
 *   - pano "60 aktif masa / 19 bekleyen çağrı" gibi anlamsız sayılar
 *     gösteriyordu — demo verisinin kalitesi kaybolmuştu.
 *
 * NEDEN SPEC BAŞINA `afterAll` DEĞİL DE GLOBAL TEARDOWN: sekiz ayrı dosyaya
 * dağıtılan temizlik, yeni bir spec eklendiğinde unutulur. Burası tek ve
 * kaçınılmaz nokta. (Kendi verisini yaratan spec'ler — `menu-crud` gibi —
 * kendi `afterAll`'unu korumaya devam ediyor; bu, onların yerine geçmez.)
 *
 * SİLME ÖLÇÜTÜ DAR TUTULDU: yalnızca testlerin ürettiği desen silinir.
 * Test masa etiketleri her zaman `Date.now()` (13 hane) ile bitiyor; seed'in
 * etiketleri ("Masa 1", "Bahçe 2", "Tezgâh") bu desenle asla eşleşmez.
 * Böylece demo kataloğuna yanlışlıkla dokunma riski yok.
 */
export default async function globalTeardown() {
  // Yerel olmayan bir Supabase'e karşı ASLA çalışmaz — bu bir temizlik
  // (silme) yolu ve yanlış ortamda koşması geri alınamaz olurdu.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  if (!url.includes("127.0.0.1") && !url.includes("localhost")) {
    console.warn(`E2E teardown atlandı: ${url} yerel değil.`);
    return;
  }

  const service = serviceRoleClient();
  const { tenantId, branchId } = SEED.acme;

  // 1) Zaman damgalı test masaları.
  //
  //    DİKKAT — `table_sessions.table_id` FK'si ON DELETE **RESTRICT**:
  //    bir kez oturum açılmış masa SİLİNEMEZ (sipariş geçmişi değişmez,
  //    RULES #36). İlk sürüm bunu hesaba katmıyordu ve `delete()`'in
  //    hatasını da okumadığı için "47 masa silindi" diye rapor ederken
  //    aslında hiçbirini silememişti (ölçüldü: sayı 60'ta kaldı).
  //
  //    Doğru davranış ürünün kendi modeli: geçmişi olan masa ARŞİVLENİR
  //    (is_active=false), geçmişi olmayan silinir. Arşivlenmiş masa panodaki
  //    "aktif masa" sayısına girmez ve /admin/tables'ta soluk görünür.
  const { data: tables } = await service
    .from("tables")
    .select("id, label, is_active")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId);

  const junk = (tables ?? []).filter((row) => /\d{13}/.test(row.label));
  const junkIds = junk.map((row) => row.id);

  let deleted = 0;
  let archived = 0;

  if (junkIds.length > 0) {
    const { data: usedRows } = await service.from("table_sessions").select("table_id").in("table_id", junkIds);
    const usedIds = new Set((usedRows ?? []).map((row) => row.table_id));

    const deletableIds = junkIds.filter((id) => !usedIds.has(id));
    if (deletableIds.length > 0) {
      const { error } = await service.from("tables").delete().in("id", deletableIds);
      if (error) console.warn(`E2E teardown: masa silinemedi — ${error.message}`);
      else deleted = deletableIds.length;
    }

    const archivableIds = junk.filter((row) => usedIds.has(row.id) && row.is_active).map((row) => row.id);
    if (archivableIds.length > 0) {
      const { error } = await service.from("tables").update({ is_active: false }).in("id", archivableIds);
      if (error) console.warn(`E2E teardown: masa arşivlenemedi — ${error.message}`);
      else archived = archivableIds.length;
    }
  }

  // 2) Testlerin ürettiği bölgeler. Seed'in üç bölgesi sabit UUID'li
  //    (…901/902/903); onun dışındaki her şey test artığıdır.
  const SEED_ZONE_PREFIX = "00000000-0000-4000-8000-0000000009";
  const { data: zones } = await service
    .from("table_zones")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId);

  const junkZoneIds = (zones ?? []).filter((row) => !row.id.startsWith(SEED_ZONE_PREFIX)).map((row) => row.id);
  if (junkZoneIds.length > 0) {
    const { error } = await service.from("table_zones").delete().in("id", junkZoneIds);
    if (error) console.warn(`E2E teardown: bölge silinemedi — ${error.message}`);
  }

  // 3) Nihai duruma ulaşmamış siparişler. SİLİNMEZ — sipariş geçmişi
  //    değişmezdir (RULES #36); yalnızca terk edilmiş oldukları için
  //    `cancelled`'a çekilir, böylece KDS panosu ve pano temiz kalır.
  const { data: openOrders } = await service
    .from("orders")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .in("status", ["pending", "approved", "preparing", "ready"]);

  if ((openOrders ?? []).length > 0) {
    const { error } = await service
      .from("orders")
      .update({ status: "cancelled" })
      .in(
        "id",
        (openOrders ?? []).map((row) => row.id),
      );
    if (error) console.warn(`E2E teardown: sipariş kapatılamadı — ${error.message}`);
  }

  // 4) Sızmış tek kullanımlık tenant'lar. Spec'lerin çoğu kendi tenant'ını
  //    `finally` içinde siliyor ama test kırılıp süreç düşerse o blok hiç
  //    çalışmıyor — ölçüm: yerelde 23 artık tenant birikmişti ve
  //    `schema-and-seed.integration.test.ts`'in "3 tenant yüklü"
  //    beklentisini kırıyorlardı.
  //
  //    Ölçüt: slug `test-` ile başlıyor. Seed tenant'ları acme/beta/gamma;
  //    gerçek bir işletmenin slug'ı bu önekle başlamaz (kayıt akışı da
  //    üretmez). Silme `tenants`'tan cascade ile şube/masa/siparişe iner.
  const { data: strayTenants } = await service.from("tenants").select("id, slug").like("slug", "test-%");
  if ((strayTenants ?? []).length > 0) {
    const { error } = await service
      .from("tenants")
      .delete()
      .in(
        "id",
        (strayTenants ?? []).map((row) => row.id),
      );
    if (error) console.warn(`E2E teardown: artık tenant silinemedi — ${error.message}`);
  }

  console.log(
    `E2E teardown: ${deleted} masa silindi, ${archived} masa arşivlendi, ` +
      `${junkZoneIds.length} bölge silindi, ${(openOrders ?? []).length} açık sipariş kapatıldı, ` +
      `${(strayTenants ?? []).length} artık tenant silindi.`,
  );
}
