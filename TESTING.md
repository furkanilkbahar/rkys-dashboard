# TESTING.md — Test Stratejisi v1.0

## 1. Katmanlar ve Araçlar
| Katman | Araç | Kapsam |
|---|---|---|
| Birim | Vitest | Saf fonksiyonlar: fiyat/KDV hesabı, sepet toplamı, pricing rules, lisans doğrulama, izin (`can()`) mantığı |
| Entegrasyon | Vitest + lokal Supabase | RLS izolasyonu, sipariş durum makinesi, stok düşümü, modül guard'ları — gerçek lokal DB'ye karşı |
| E2E | Playwright | Kritik kullanıcı akışları, gerçek tarayıcıda (mobil viewport dahil) |

- Test altyapısı (Vitest + Playwright + örnek testler) **Faz 0'da** kurulur.
- CI her PR'da **tüm test paketini** koşar → regresyon otomatik yakalanır. Kırmızı testle merge yok (RULES 22/43).

## 2. Faz Kapanış Kriteri (Definition of Done)
Bir faz şunlar olmadan kapanmaz:
1. Fazın yeni özelliklerinin birim/entegrasyon testleri yazıldı.
2. Faza ait E2E senaryoları (aşağıdaki listeden ilgili olanlar) Playwright'ta geçiyor; daha önce sohbette sunulan manuel test maddeleri varsa karşılığı otomatik teste dönüştürülür (bkz. §5).
3. **Önceki tüm fazların testleri dahil** paket yeşil.
4. Claude Code otomatik test paketinin sonucunu sohbette özetler; **fazlar arası geçiş kullanıcı onayına tabidir** (D73) — faz içindeki adımlar için ayrıca onay beklenmez.

## 3. Kritik E2E Senaryoları (yaşayan liste — her fazda genişletilir)
| # | Senaryo | Faz |
|---|---|---|
| S1 | Masa QR okut → menü açılır → varyant+ekstra ile ürün ekle → sipariş ver → KDS'de belirir | 1 |
| S2 | Onay modlu tenant: sipariş garson onayına düşer; onaysız mutfağa gitmez | 1 |
| S3 | Tipsiz garson çağrısı → garson panelinde ısrarcı bildirim → karşılandı | 1 |
| S4 | İptal: pending'de serbest; preparing'de istek→garson onayı akışı | 1 |
| S5 | **Tenant izolasyonu (E2E):** A tenant menüsünde B'nin ürünü/siparişi asla görünmez | 1 |
| S6 | Bağlantı kopması: telefon offline→online; sepet korunur, çift sipariş oluşmaz (idempotency) | 1 |
| S7 | Kapalı modül: route/API/navigasyonda görünmez; doğrudan URL → engellenir | 2 |
| S8 | Onboarding iki yol: demo veri keşfi + temizleme; sıfırdan sihirbaz tamamlanır | 2 |
| S9 | Kasa: vardiya aç → POS-lite sipariş → ödeme al → gün sonu sayım/fark raporu | 3 |
| S10 | İkram/indirim: izinsiz personel yapamaz; sebep kodu zorunlu; kayıp-kaçak raporunda görünür | 3 |
| S11 | Tam iade: online=iyzico iadesi, kasa=manuel kayıt; rapora doğru yansır | 3 |
| S12 | Plan limiti: masa/şube limiti dolunca ekleme engellenir, yükseltme yönlendirmesi | 4 |
| S13 | Trial bitişi ve abonelik durum geçişlerinde erişim davranışı | 4 |
| S14 | Süper Admin: tenant askıya al → tenant yüzeyleri kilitlenir | 4 |
| S15 | Destek ticket: tenant açar → Süper Admin yanıtlar → durum akışı | 4 |
| S16 | Çok dilli menü: dil değişimi fiyat/para birimi formatını bozmaz | 2 |
| S17 | Şube: ikinci şube açılınca seçici belirir; şube override fiyatı doğru uygulanır | 4+ |
| S18 | Hesap bölme (eşit) ve bahşiş akışı uçtan uca | 3/6 |
| S19 | Değerlendirme: oturum kapanınca yıldız+yorum+garson puanı istenir; 4-5★ Google'a yönlenir, ≤3★ içeride kalır | 3 |
| S20 | Kayıt: pazarlama sitesinden self-servis kayıt → yeni tenant oluşur, otomatik giriş yapılıp onboarding'e düşer; aynı alt alan adı ikinci kez kullanılamaz | 4 |
| S21 | Dönem Raporu: tarih aralığı seçilince toplam + geçen yıl kıyası güncellenir; `reports.loss` izni olan personel kayıp-kaçak tablosunu görür | 5 |
| S22 | Analitik paneli: widget'lar görünür, sürükle-bırak sıralaması ve gizle/göster durumu kullanıcı bazlı kalıcı olur | 5 |
| S23 | Hedef: aylık ciro hedefi girilir, ilerleme (ciro/hedef) gösterilir; anomali uyarısı panelde görünür, onaylanınca kaybolur | 5 |
| S24 | Zamanlanmış rapor oluşturulur; "Şimdi Gönder" ile anlık tetiklenir, PDF üretilip mock e-postaya kaydedilir, son gönderim zamanı güncellenir | 5 |
| S25 | Kasa — kalem seçerek ödeme: hesap yalnızca seçilen kalemler ödendiğinde kapanır, kalan kalemler için açık kalır | 6 |
| S26 | Kasa — kısmi iade: ödeme "kısmen iade edildi" olur, kalan tutar için ikinci kısmi iade tam iadeye tamamlar | 6 |
| S27 | Kampanya/kupon: admin yüzde indirimli kampanya + kupon oluşturur, misafir sepetinde kupon kodunu uygular, indirim comps'a yazılır | 6 |
| S28 | Mutfak istasyon filtresi: kategoriye istasyon atanır, KDS'de istasyon seçilince yalnızca o istasyonun kalemleri (ve o kalemleri içeren siparişler) görünür | 6 |
| S29 | Tema yönetimi: admin ayarlardan temayı değiştirir, hem admin hem misafir menü tarafında doğru `data-theme` uygulanır; self-hosted paket yerel `docker build`+`docker-compose up` ile doğrulanır | 6 |
| S30 | Müşteri kimliği: misafir telefon+OTP+KVKK onayıyla sadakat programına katılır, mevcut masa oturumu (sipariş/ödeme akışı) hiç değişmeden oturuma bağlanır | 7 |
| S31 | Sadakat motoru: admin puan modunu (kazanım/harcama oranı) ayarlar, misafir bakiyesini kendi siparişine indirim olarak kullanır, indirim comps'a yazılır | 7 |
| S32 | Hediye kartı: admin kart oluşturur (kod+ilk bakiye), kasa hediye kartıyla ödeme alır, bakiye düşer ve hesap kapanır | 7 |
| S33 | Sadakat/kampanya performans raporu: dönem içindeki kazanım/harcama, aktif müşteri ve kampanya kullanım sayıları/indirim toplamı doğru hesaplanır | 7 |
| S34 | Reçete düşümü: admin malzeme tanımlar, ürünü reçeteden düşecek şekilde ayarlar ve reçeteyi kaydeder; kasadan sipariş verildiğinde ilgili malzemenin stoğu otomatik düşer | 8 |
| S35 | Tedarik: admin tedarikçi ekler, malzemeye miktar+birim maliyet+tedarikçi ile alım girer; stok artar, hareketli ortalama maliyet doğru güncellenir | 8 |
| S36 | Fire/sayım: admin fire kaydeder (stok düşer) ve fiziksel sayım girer (stok sayılan değere eşitlenir); kritik seviyenin altındaki malzemeler sayfa üstünde özetlenir | 8 |
| S37 | Menü mühendisliği matrisi: dönem içi satışlar popülerlik×marj ortalamasına göre Yıldız/Beygir/Bilmece/Zayıf kategorilerine doğru ayrılır, reçeteden otomatik hesaplanan maliyet rapora yansır | 8 |
| S38 | Gel-Al (pickup): misafir bağlantıdan (fiziksel masasız) sipariş verir, teslim kodu görür; mutfak siparişi hazır işaretleyince misafir bildirim alır — aynı sipariş/KDS motoru kanal farkıyla çalışır | 9 |
| S39 | Paket servis (delivery): misafir teslimat bölgesi seçer, adres girer; bölge ücreti toplama eklenir, minimum sepet altındaki siparişler reddedilir | 9 |
| S40 | Kurye modülü: personel (garson paneli) bir delivery siparişine kurye atar; kurye kendi panelinde teslimatı Atandı→Yolda→Teslim Edildi olarak ilerletir | 9 |
| S41 | Tenant API: admin API anahtarı oluşturur, gerçek anahtarla `/api/v1/orders` yalnızca kendi tenant'ının siparişlerini döner; anahtarsız istek 401, iptal edilen anahtar da 401 döner | 10 |
| S42 | Webhook'lar: admin webhook kaydeder (URL + olay tipi seçimi), imza sırrı (`whsec_...`) ekranda görünür; sipariş oluşunca/durum değişince ilgili olay otomatik kuyruğa girer, HMAC imzalı gerçek HTTP POST ile teslim edilir (2xx→delivered, 5xx→üstel geri çekilmeyle retry); admin webhook'u pasif hale getirebilir | 10 |
| S43 | Pazar yeri: admin ürün↔SKU eşlemesi kurar; aracı platform tenant API anahtarıyla gerçek HTTP POST ile sipariş gönderir, sipariş `channel='marketplace'`/`status='approved'` olarak doğrudan KDS'e düşer, stok düşer; aynı external_order_id tekrar gönderilirse yeni sipariş açmaz (idempotent), eşlenmemiş SKU reddedilir | 10 |
| S44 | Muhasebe: admin tamamlanmış ('served') bir siparişi mock muhasebe sağlayıcısına gönderir, senkronizasyon geçmişinde görünür ve gönderilecekler listesinden düşer; RLS başka tenant'ın senkronizasyon kaydını gizler ve sahte kayıt eklemeyi engeller; ÖKC adaptör kapısı yalnızca arayüz olarak dokümante edilir (implementasyon yok) | 10 |
| S45 | Rezervasyon + bekleme listesi: misafir oturumsuz rezervasyon talebi gönderir ('pending'); admin masa atayıp onaylar ('confirmed'), oturtur ('seated'); admin bekleme listesine walk-in ekler, çağırır ('called'), oturtur; RLS başka tenant'ın rezervasyon/bekleme listesini gizler | 11 |
| S46 | Kiosk modu: admin kiosk cihazı ekler (pairing code üretilir); tablet `/kiosk/[pairingCode]/baslat` ile aynı /paket sayfasına bağlanır (kod yeniden kullanımı), oturuma kiosk_device_id işlenir; "Sıradaki Müşteri" mevcut oturumu kapatıp yeni bir oturum açar; geçersiz/pasif cihaz kodu reddedilir | 11 |
| S47 | Vardiya planlama + puantaj: admin `/admin/staff`'tan yetkili cihaz oluşturur (ham secret bir kerelik gösterilir) ve personele PIN atar; cihaz `/vardiya/kurulum`'da secret'ı doğrulayıp eşlenir; personel PIN pad ile giriş/çıkış yapar (ilk çağrı 'in', ikinci 'out'); yanlış PIN/geçersiz veya iptal edilmiş cihaz reddedilir; admin haftalık çizelgeye vardiya ekler, çalışma saati raporu ve CSV export görüntülenir | 11 |
| S48 | Garson paneli — masa taşıma (RULES #27, Faz 2 açığı kapatıldı): `session.move` izni olan personel garson panelinde dolu bir masayı boş bir masaya taşır, oturum ve `session_events` audit kaydı doğru güncellenir; izinsiz personelde/misafirde bölüm hiç görünmez (mevcut `move_table_session` RPC testleri zaten izin reddini kapsıyor) | genel gözden geçirme |
| S49 | Faz 4 revizyonu — şema temeli: `plan_modules`/`module_requests` RLS izolasyonu (tenant A/B); `apply_plan_change` yükseltmede `pending_removal_since`'i temizler, düşürmede işaretler, `paid_addon` kaynaklı satıra hiç dokunmaz | Faz 4 revizyonu |
| S50 | Faz 4 revizyonu — plan yönetimi: platform admin `/platform/plans`'tan yeni plan açar (ad/fiyat/masa-şube limiti + 15 modül checkbox'ı), mevcut planı düzenler; `plans.key` artık sabit 3 değere kilitli değil | Faz 4 revizyonu |
| S51 | Faz 4 revizyonu — onay kuyruğu: elle `pending_approval` yapılmış bir tenant, platform admin `/platform/pending-tenants`'tan onaylayınca `active` olur ve planının modülleri açılır; reddedilince kapalı kalır | Faz 4 revizyonu |
| S52 | Faz 4 revizyonu — kapalı kapı kayıt: kayıt ol → kök domainde öde (mock, auto-approve KAPALI) → alt-domain (admin/login dahil) hâlâ tamamen kapalı → platform admin onaylar → giriş açılır; auto-approve AÇIK iken ödeme sonrası anında aktif olur | Faz 4 revizyonu |
| S53 | Faz 4 revizyonu — tenant başına elle modül yönetimi: platform admin tenant detayında 15 modülün tamamını (durum + kaynak etiketi) görür, elle açtığında `source='granted'` ile işaretlenir, plan değişikliği bu satırı etkilemez | Faz 4 revizyonu |
| S54 | Faz 4 revizyonu — plan düşürme incelemesi: düşürmede plandan gelen modül hemen silinmez (`pending_removal_since` dolar, açık kalır), `paid_addon` asla işaretlenmez; platform admin "Koru" derse kalıcı korunur (`source='granted'`, bir daha işaretlenmez), "Kaldır" derse kapanır; tenant'ın kendi ödeyerek yaptığı plan değişikliği de aynı incelemeden geçer | Faz 4 revizyonu |
| S55 | Faz 4 revizyonu — Talep Et akışı: tenant plan dışı bir modülü talep eder, platform admin onaylayınca anında açılır (`source='granted'`), reddedilince tenant ekranında kilitli kalmaya devam eder | Faz 4 revizyonu |

## 4. RLS İzolasyon Testleri (entegrasyon, zorunlu şablon)
Her yeni tablo için otomatik üretilen test çifti:
- A tenant'ı olarak B'nin satırı SELECT/UPDATE/DELETE edilemez.
- branch_id'li tablolarda yetkisiz şube erişimi engellenir.

## 5. Faz Kapanış Doğrulaması (otomatik, iki onay adımlı — D73/D74)
Kullanıcı fiilen manuel test yapmak istemiyor ama neyin test edildiğini görmek ve otomatik koşumu onaylamak istiyor. Sıra:
1. **Senaryo listesi:** Claude Code, o fazın kapanışında eski manuel-test-listesi formatında okunabilir bir senaryo listesi sunar (örn. "1. X açılır ve Y görünür. 2. A tenant'ı B'nin verisini göremez. ..."). Bu liste bilgilendirme amaçlıdır — kullanıcı isterse kendisi de elle bakabilir.
2. **Koşum onayı:** Ardından açıkça sorar: *"Bunları siz test edebilirsiniz, ya da onay verirseniz sizin yerinize otomatik olarak ben yaparım."* Onay gelmeden paket çalıştırılmaz.
3. **Otomatik koşum:** Onay sonrası her senaryonun karşılığı olan Playwright E2E / entegrasyon testi çalıştırılır (yeni senaryolar `tests/e2e/` veya `tests/integration/` altına eklenir), sonuç katman/sonuç tablosu + toplam olarak sohbette gösterilir (bkz. [[feedback_test_summary_output]] tarzı özet).
4. **Faz geçiş onayı:** Paket yeşilse Claude Code ayrıca bir sonraki faza geçmek için onay ister (D73, değişmedi) — bu, 2. adımdaki koşum onayından **ayrı** bir onaydır.
- Gerçek cihaz/görsel kontrol otomatikleştirilemez — bloklayıcı değildir, senaryo listesinde not düşülür, kullanıcı isterse kendisi kontrol eder.
- Faz içindeki uygulama adımları için ayrıca onay beklenmez (kullanıcı kararı; Faz 4'te tekrar değerlendirilecek) — bu ritüel yalnızca faz kapanışına özeldir.

## 6. Kapsam Dışı (bilinçli)
- %100 kapsama hedefi yok; hedef **kritik akışların** korunması.
- Görsel piksel-regresyon testi, yük/performans testi → Faz 12 havuzu.

## 7. Bilinen Test Açıkları
- `tests/e2e/staff/waiter-call-realtime.spec.ts`: **kısmen giderildi, kök neden ortamda** (2026-07-24 genel gözden geçirme). İki ayrı sorun karıştı, ikisi de bu oturumda ayrıştırıldı:
  1. **Giderildi:** test kendi açtığı "Masa 3" çağrısını `finally`'de temizlemiyordu; birçok tam E2E koşumu paylaşılan "acme" tenant'ında karşılanmamış onlarca eski çağrı biriktirmişti (gözlemlenen: "Masa 1" için 18 açık çağrı), bu da `.first()` locator'ının eski satırla eşleşmesine yol açıyordu. Test artık `clearOpenCallsForTable3()` ile hem baştan hem `finally`'de kendi masasının açık çağrılarını temizliyor.
  2. **Giderilemedi — yerel Supabase Realtime ortam sorunu:** Temiz veriyle bile panel misafirin çağrısını asla almıyor ("Bağlı" görünse de "Açık çağrı yok" kalıyor). WebSocket çerçeveleri incelendiğinde (`page.on("websocket")`) Realtime sunucusunun `postgres_changes` filtresini reddettiği görüldü: `"Exception: ERROR P0001 (raise_exception) invalid column for filter tenant_id"` — hem `waiter_calls` hem `orders` için, HER İKİSİ de `tenant_id` kolonuna sahip ve `has_column_privilege('authenticated', ..., 'tenant_id', 'SELECT')` doğrudan psql'den `true` dönüyor. Hatanın kaynağı `realtime.subscription_check_filters()` tetikleyicisi (`col_names` hesabı `new.claims ->> 'role'` ile `has_column_privilege` kullanıyor) — ama aynı INSERT'i postgres olarak elle simüle etmek HATA VERMİYOR, yalnızca gerçek Realtime servisi üzerinden hata oluşuyor. `npx supabase stop --no-backup` + `start` + `db reset` (tamamen temiz volume) sonrasında bile aynı şekilde tekrarlanıyor — bu yüzden veri/önbellek kirliliği değil, kullanılan yerel Realtime imajıyla (`public.ecr.aws/supabase/realtime:v2.112.6`, CLI 2.109.1) ilgili bir sürüm/uyumluluk sorunu olduğu değerlendiriliyor. Uygulama kodu, şema, RLS ve GRANT'ler doğrulandı — hatalı olan bulunamadı. Öneri: Supabase CLI'yi güncelleyip farklı bir realtime imaj sürümüyle tekrar denemek; üretimde (Supabase Cloud'un yönetilen realtime servisi) bu spesifik yerel-imaj sorununun oluşması beklenmiyor. `waiter-panel.tsx`'in tek kanalda iki tablo filtresi birleştirmesi de (kds-panel.tsx'in kanıtlanmış tablo-başına-kanal desenine uyacak şekilde) ayrıca ayrıştırıldı — bu kök nedeni tam çözmedi ama gereksiz karmaşıklığı azalttı ve gelecekteki çoklu-filtre etkileşim riskini ortadan kaldırdı.
- `tests/integration/orders/webhooks.integration.test.ts` (gerçek ağ testleri, "Webhook teslimatı: imzalama + retry"): **kısmen giderildi** (2026-07-24 genel gözden geçirme) — sabit 2sn bekleme, `reconcile_webhook_deliveries`'i yanıt gelene kadar (maks. 8 deneme × 1sn) tekrar çağıran bir `pollUntilSettled` polling yardımcı fonksiyonuna çevrildi; bu, RPC/kod tarafında hiçbir değişiklik gerektirmedi ve gecikme varyansına karşı çok daha dayanıklı. Ancak testler yine de gerçek `https://httpbin.org` uçlarına bağımlı olduğu için tamamen kırılganlıktan arındırılamaz: gözden geçirme sırasında `curl` ile doğrudan test edildiğinde httpbin.org'un art arda `503 Service Unavailable` döndürdüğü gözlemlendi (muhtemelen bu oturumun debug amaçlı yaptığı çok sayıda otomatik/elle isteğin geçici rate-limit'e yol açması) — bu, uygulama kodunun DEĞİL, dış servisin o anki kullanılabilirliğinin bir fonksiyonu. Kalıcı çözüm ayrı bir görevde ele alınabilir (ör. kendi mock HTTP sunucumuzu (yerel bir Express/Fastify endpoint'i) pg_net'in hedefi yapmak — dış bağımlılığı tamamen ortadan kaldırır).
