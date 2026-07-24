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
- `tests/e2e/admin/menu-reorder.spec.ts` (Faz 2, kategori sürükle-bırak sıralaması): chromium-desktop ve mobile-safari'de, izole/seri çalıştırmada bile tutarlı şekilde başarısız oluyor. Faz 6 kapanış commit'inde (`1cbccf0`) de aynı şekilde başarısız olduğu doğrulandı (Faz 7 kapanışında, 2026-07-24) — sonraki fazların sebep olduğu bir regresyon değil, muhtemelen dnd-kit'in senkron `page.mouse` simülasyonuyla uyumsuzluğu. Ayrı bir görevde ele alınacak, faz kapanışlarını bloklamıyor.
- `tests/integration/orders/loyalty-campaign-reports.integration.test.ts` VE `tests/e2e/admin/loyalty-campaign-reports.spec.ts` (Faz 7 Adım 3, S33): `get_loyalty_performance_report`/`get_campaign_performance_report` doğru şekilde tenant-local tarihe göre gruplar (`(created_at at time zone tenant.timezone)::date`), ama her iki test de "bugün"ü UTC saatinden hesaplıyor (`new Date().toISOString().slice(0,10)`). Tenant saat dilimi Europe/Istanbul (UTC+3) olduğu için, UTC 21:00–24:00 arasında (İstanbul'da gece yarısını geçmiş ama UTC'de henüz geçmemiş) test tarihi ile satırların gerçek tenant-local tarihi uyuşmuyor ve testler yanlışlıkla 0 sonuç bekliyor gibi başarısız oluyor — RPC değil, testlerin tarih hesaplaması hatalı. Faz 8 sırasında keşfedildi (2026-07-23/24, UTC 21:00–24:00 penceresinde çalıştırılan her koşumda tekrarlandı — E2E versiyonu Faz 8 kapanışında da aynı şekilde başarısız oldu), Faz 7 kapsamında ayrı bir görevde düzeltilecek.
