# PLAN.md — Geliştirme Yol Haritası

> v3.0 — İlke: çekirdek önce, her şey modül. Her faz çalışır+test edilmiş biter; faz atlanmaz.
> Şema kuralı: Bir fazda UI'ı gelmeyecek olsa bile, ilgili tabloların temeli **kendi "şema kapısı" notuna göre erken migration'larda** atılır (acı migration yaşamamak için).

---

## Faz 0 — Temel Kurulum
- [x] Next.js (TS strict) + Tailwind + shadcn/ui + Framer Motion; route group iskeleti (cashier ve analytics dahil)
- [x] **Lokal geliştirme ortamı:** Docker + Supabase CLI (`supabase start`), tüm sistem lokalde çalışır; GitHub repo + CI (tsc/lint/test zorunlu)
- [x] Prod+Staging (Vercel + Supabase Cloud) tanımı (`docs/environments.md`) — PR preview ve gerçek deploy canlıya alma proje olgunlaşınca (D67, D72)
- [x] Tenant middleware + `tenant_domains`; **`branches` katmanı** (otomatik tek şube, gizli seçici altyapısı)
- [x] Auth + roller (courier dahil) + `role_permissions` izin bayrağı altyapısı + `staff_devices`/PIN şeması
- [x] **`tenant_modules` Modül Sistemi** (isEnabled guard, navigasyon filtreleme)
- [x] `warm-luxury` tema token seti + tema altyapısı
- [x] Sentry + temel loglama kancaları (OPERATIONS.md standartları)
- [x] **Test altyapısı:** Vitest + Playwright kurulumu, RLS izolasyon test şablonu, CI'da tam paket koşumu (bkz. TESTING.md)

## Faz 1 — QR Menü + Sipariş Çekirdeği
- [x] Menü şeması (layout+station, `track_mode`, `branch_product_overrides` temeli) + çeviri + basit stok
- [x] Masa QR + genel QR (masa seçtiren) + imzalı oturum token
- [x] Premium menü UI (varsayılan düzen, dil seçici, mikro animasyonlar)
- [x] Sepet koruması + idempotency'li sipariş (channel=`dine_in`) + server-side stok kontrolü
- [x] Durum makinesi + direct/approval + karma iptal; oturum yaşam döngüsü + **masa taşıma (personel)**
- [x] Garson Çağır (tipsiz + tipler) + KDS + Garson paneli + ısrarcı sesler + bağlantı göstergesi
- [x] Müşteri oturum görünümü + hazır ses/titreşim

## Faz 2 — Admin Panel + Onboarding
- [x] Menü CRUD, drag&drop, çeviri editörü, kategori düzeni seçimi
- [x] Görsel yükleme + otomatik optimizasyon + hazır kütüphane
- [x] Masa/bölge + QR baskı şablonları (tema uyumlu, çoklu format)
- [x] Personel (roller, PIN, cihaz yetkilendirme, **izin bayrakları UI**), garson profili
- [x] Ayarlar: sipariş modu, timeout, çağrı tipleri, diller, para birimi, bahşiş çipleri, değerlendirme, tema, **Modül aç/kapa ekranı**
- [x] Onboarding: demo veri (toplu temizleme) / sıfırdan kur (+**modül seçimi adımı**)
- [x] **Faz 2 revizyonu (D85, 2026-07-28):** tek sabit demo şablonu yerine 3 çoklu demo menü şablonu (kafe/restoran/pastane, 4 kategori × 4 ürün + görsel) — hem giriş ekranındaki "Demo veriyle keşfet" hem sihirbazın "Şablon Menü" adımı `TemplatePicker` ile 3 kart gösteriyor. Görseller şimdilik stok arama ile geldi, AI üretimi altyapısı kurulunca değiştirilecek (bkz. Faz 20).
- [x] **Faz 2 revizyonu (D87, bug-hunt 2026-08-01):** "yeni personel oluşturma" hiç yoktu (yalnızca var olanı düzenleme vardı) — `/admin/staff`'a rol+rozet+PIN ile gerçek hesap açan bir form eklendi. Aynı pakette: garson artık `/waiter/login`'den kendi PIN'iyle, owner'ın admin oturumundan tamamen bağımsız giriş yapabiliyor (owner çıkışı garsonu artık düşürmüyor) — ayrı cookie adı altında gerçek bir Supabase oturumu (`auth.admin.generateLink`+`verifyOtp`) açılarak, RLS/RPC katmanına hiç dokunulmadan.

## Faz 3 — Kasa + Ödeme + İade/İkram + Temel Raporlar
- [x] **Kasa modülü:** vardiya aç/kapa, nakit sayım/fark, `cash_movements`, **POS-lite sipariş girişi**, gün sonu (`day_closures`)
- [x] iyzico online ödeme + webhook; Hesap İste bütünlüğü; **eşit bölüşme**; bahşiş çipleri (iyzico: sandbox anahtarı gelene kadar mock ile doğrulandı, gerçek adaptör kodu tamamlandı)
- [x] **İkram/indirim** (izin bayrağı + sebep kodu) + **tam iade** (online otomatik / kasa manuel)
- [x] Değerlendirme sistemi (garson puanlı + Google köprüsü)
- [x] Temel rapor seti + **manuel maliyet & marj raporu** + CSV export (Excel: UTF-8 BOM'lu CSV ile karşılandı; muhasebe API adaptörü ileri faz kapsamında — D61)

## Faz 4 — SaaS Katmanı
- [x] Süper Admin: tenant/şube, kullanım, duyurular (banner), 2FA zorunluluk anahtarı
- [x] Planlar: masa limiti + **dahil şube + ek şube ücreti** enforcement; 14g kartsız trial; iyzico abonelik (mock-first)
- [x] Lisans modülü (lifetime/self-hosted) + doğrulama API (tamamen offline, imzalı dosya)
- [x] Pazarlama sitesi (TR/EN, modüler anlatım) + yasal set (KVKK/çerez/sözleşme/veri silme)
- [x] **Destek ticket modülü** (tenant talep → Süper Admin kuyruğu)
- [x] **Status sayfası** + uptime izleme (OPERATIONS) — D72 sınırı: veri modeli + manuel giriş, gerçek 3.parti alerting production'a ertelendi
- [x] **Faz 4 revizyonu (D80/D81):** Süper Admin artık serbest **plan CRUD** yürütür (ad/fiyat/masa-şube limiti + her planın içerdiği modülleri işaretleyen `plan_modules`) ve tenant başına elle modül aç/kapa yapar (kaynak etiketli: `plan`/`paid_addon`/`granted`). Kayıt akışı **kapalı kapı**: form gönderilince tenant `pending_approval` ile açılır ve alt-domaini (admin login dahil) tamamen kapalı kalır; ödeme kök domainde (`/kayit/odeme`) alınır; onay platform admin'in elle kararına VEYA genel `auto_approve_registrations` ayarına bağlıdır — onaylanınca planın modülleri otomatik açılır. Plan değişikliği (platform admin ataması veya tenant'ın kendi `/admin/billing` ödemesi) artık paylaşılan `apply_plan_change` üzerinden yürür: düşürmede plandan gelen modüller hemen silinmez, platform admin incelemesine (Koru/Kaldır) düşer; `paid_addon` kaynaklı modüllere hiç dokunulmaz. Tenant kendi panelinde plan dışı bir modülü "Talep Et" ile platform admin onayına sunabilir.

## Faz 5 — Analitik Merkezi
- [x] Widget dashboard (sürükle-bırak) + şube kıyası (`(analytics)/analytics`, 6 widget, kullanıcı bazlı kalıcı düzen)
- [x] Hedefler + anomali uyarıları (`daily_sales_summary` altyapısı) — gecelik pg_cron taraması, %30+ ciro düşüşünde uyarı
- [x] **Zamanlanmış e-posta/PDF raporları** — lib/email (mock-first, Resend adaptörü D72 sınırı: anahtar gelene kadar doğrulanmadı) + @react-pdf/renderer
- [x] Rol/izin bazlı rapor erişimi; dönem + geçen yıl karşılaştırmaları; kayıp-kaçak (sebep kodlu) raporu — `reports.loss` izni, iptal sebep kodu için `orders.cancel_reason_code_id` eklendi (onay UI'ı ayrı bir Faz 1 eksiği olarak not edildi)

## Faz 6 — Gelişmiş Ödeme + Kampanya + Tema/Self-Hosted
- [x] **Kalem bazlı hesap bölme** + **kısmi iade** (ortak altyapı) — S25 (Adım 0), S26 (Adım 1)
- [x] **Pricing Rules motoru v1** + **kural bazlı kampanya/kupon** (kod üretimi, limitler) — S27 (Adım 2)
- [x] Mutfak **istasyon ekranları** aktivasyonu — S28 (Adım 3)
- [x] Tema yönetimi UI + 1 ek tema; **self-hosted paket** (docker-compose + lisans entegrasyonu) — S29 (Adım 4), yerel `docker build`+`docker-compose up` ile doğrulandı

## Faz 7 — CRM & Sadakat
- [x] Telefon+OTP müşteri hesabı (KVKK onaylı) + müşteri kartları — S30 (Adım 0)
- [x] **Sadakat motoru:** damga/puan (tenant seçer) + kazanım/harcama akışları — S31 (Adım 1)
- [x] **Hediye kartı modülü** (bakiye muhasebesiyle) — S32 (Adım 2)
- [x] Sadakat/kampanya performans raporları — S33 (Adım 3)

## Faz 8 — Stok Derinliği & Maliyet
- [x] Malzeme + **reçete motoru** (satışta otomatik düşüm, ürün başına mod seçimi) + fire/sayım hareketleri — S34 (Adım 0), S36 (Adım 2)
- [x] Basit alım girişi + hareketli ortalama maliyet + kritik stok uyarıları + `suppliers` — S35 (Adım 1)
- [x] **Menü mühendisliği matrisi** (otomatik maliyetle) + aksiyon önerileri — S37 (Adım 3)

## Faz 9 — Kanallar: Gel-Al & Paket
- [x] `pickup` kanalı (hazır bildirimi + teslim kodu) — S38 (Adım 0)
- [x] `delivery`: adres/bölge/ücret/min sepet + **zamanlanmış sipariş** — S39 (Adım 1)
- [x] **Kurye modülü** (atama, yolda→teslim, gün sonu özeti) — S40 (Adım 2)

## Faz 10 — API & Entegrasyonlar
- [x] **Tenant API:** API key yönetimi + imzalı **webhooks** (retry'lı) + read-only API
- [x] Yazma API'si → **pazar yeri adaptörü** (karma strateji D70: aracıyla çıkış → doğrudana kademeli geçiş; Yemeksepeti resmî Plugin başvurusu paralel yürür) → siparişler kanal etiketiyle KDS'e
- [x] Muhasebe **API adaptörü** (örn. Paraşüt); ÖKC adaptör kapısı dokümantasyonu

## Faz 11 — Ek Modüller
- [x] **Rezervasyon + bekleme listesi** (masa haritası entegre)
- [x] **Kiosk modu** (menünün dokunmatik modu)
- [x] **Vardiya planlama + puantaj** (çizelge, PIN giriş-çıkış, saat raporu, maaş exportu)

## Faz 12 — Gelecek Havuzu
Mobil uygulama + push · Donanım paketi (termal/mutfak yazıcısı, çekmece, barkod, ÖKC) · Canlı kurye takibi · Segmentli kampanya + İYS iletişim modülü · Kademe sadakat · Tam PO/tedarik · Özel rol oluşturma · Çoklu kur · Yardım Merkezi · SLA'lı kurumsal paket  *(Wi-Fi portalı kapsam dışı — D69)*

## Faz 13 — Pazarlama Sitesi Yeniden Yapılanması ✅
Rakip analizi (adisyo/Menulux/Orion POS/robotPOS/Protel, 2026-07) sonrası D82 kararıyla açıldı. Kapanış paketi yeşil (2026-07-28): unit 29/29, entegrasyon ×2 421/421, E2E 7/7.
- [x] Gerçek fiyatlandırma: ana sayfa `plans`/`plan_modules`'tan gerçek ₺ fiyat + plan başına modül listesi gösterir (D68'in "taslak fiyat" notu kapandı)
- [x] Değer önerisi + 15 modülün tamamını gösteren modül vitrini + entegrasyon (Yemeksepeti/Getir/Trendyol, Logo/Mikro/Paraşüt) şeridi
- [x] SSS (FAQ) sayfası + iletişim/demo talep formu
- [x] Blog iskeleti (boş state) + sosyal kanıt bölümü iskeleti

## Faz 14 — Geliştirici Portalı & Donanım İçeriği ✅
Kapanış paketi yeşil (2026-07-28): unit 29/29, entegrasyon 421/421, E2E 2/2.
- [x] Public API/webhook dokümantasyon sayfası (kimlik gerektirmez) — `/gelistirici`
- [x] Donanım uyumluluk/tavsiye içerik sayfası — `/donanim` (bugün çalışanlar + yol haritası, uydurma marka/entegrasyon iddiası yok)

## Faz 15 — Ücretli Ek Modül Ekonomisi ✅
`tenant_modules.source='paid_addon'` (Faz 4 revizyonu) üzerine gerçek à la carte faturalandırma. Kapanış paketi yeşil (2026-07-28): unit 29/29, entegrasyon ×2 427/427, E2E 2/2.
- [x] `module_addon_prices` tablosu (ayrı tablo, plan_modules'a eklenmedi — Varsayım, plan_modules'un semantiği "plana dahil" olduğundan fiyat için ayrı tablo daha temiz) + mock-first satın alma checkout'u
- [x] Tenant tarafı "Satın Al" seçeneği (mevcut "Talep Et" akışının yanına)
- [x] Platform tarafı modül fiyat yönetimi (`/platform/plans`)

## Faz 16 — Personel Motivasyonu & Kurye Canlı Takip
- [x] Personel hedef/rozet sistemi (satış hedefi + ilerleme raporu) — S65
- [x] Kurye canlı konum takibi (Leaflet + OpenStreetMap, ücretsiz/anahtarsız) — S66

## Faz 17 — ÖKC/Mali Yazarkasa Adaptör Kapısı ✅
Gerçek GİB sertifikasyonu bu kapsamda alınamaz — iyzico/e-posta ile aynı mock-first adaptör deseni (arayüz + mock + dokümantasyon). Kapanış paketi (2026-07-28): unit 29/29, entegrasyon 437/438 (1 hata — `webhooks.integration.test.ts`, gerçek `httpbin.org`'a pg_net üzerinden bağımlı, bilinen dış-ağ kırılganlığı, bu fazla ilgisiz), migration 0084 prod Supabase Cloud'a uygulandı. E2E tam paketinde 21 başarısız + 24 flaky test görüldü ama hiçbiri fiskal koduna dokunmuyor (onboarding/kasa/mutfak/sadakat/rezervasyon/smoke gibi önceki fazlardan kalma birikmiş test bakım borcu) — bkz. Faz 19.
- [x] `lib/fiscal/provider.ts` arayüzü + mock adaptör + admin ayarı — S67

## Faz 18 — Bayilik/Reseller Kanalı
- [ ] İş modeli netleştirme (komisyon %, ödeme periyodu, onboarding) — kod öncesi kullanıcıyla netleşir
- [ ] Netleşen modele göre şema + platform admin bayi yönetimi + referans kodu akışı

## Faz 19 — E2E Test Bakımı
2026-07-28 Faz 17 kapanışında tam E2E paketi koşturulunca ortaya çıktı: 21 test kalıcı başarısız + 24 flaky, fiskal entegrasyonla ilgisiz. Triyaj (2026-07-28): azaltılmış worker sayısıyla tekrar koşturulunca bu listenin büyük kısmı (~35/45) tek dev sunucusuna karşı yüksek paralellikten kaynaklanan yük/zamanlama kırılganlığı çıktı — izole/az yükte güvenilir geçiyorlar (bkz. playwright.config.ts'teki mevcut "realtime testleri yüksek paralellikte" notu, kapsamı bu sefer daha genişmiş). Geriye gerçek, tekrarlanabilir 5 sorun kaldı:
- [x] `smoke/app-boots.spec.ts` — marketing sayfasındaki "Neden RKYS Dashboard" başlığı `getByText('RKYS Dashboard')`'u 2 elemente düşürüyordu (strict-mode) → locator `banner` rolüyle daraltıldı
- [x] `staff-scheduling.spec.ts` (S47) — personel hedef/rozet satırı (Faz 16) "OWN-1" metnini tekrarlıyordu → `.first()` ile daraltıldı
- [x] `menu/campaigns.spec.ts` (S27) — kampanya seçim kutusunun gösterilen değeri "Test Kampanyası" metnini tekrarlıyordu → `.first()` ile daraltıldı
- [x] `staff/waiter-call-realtime.spec.ts` — kök neden (bug-hunt 2026-08-01): `waiter-panel.tsx` postgres_changes event'ine %100 güveniyordu, kaçan/gecikmiş bir event için hiçbir telafi yoktu (session-panel.tsx'teki misafir tarafında zaten var olan D30 polling deseni garson tarafında hiç uygulanmamıştı) — ayrıca her event'te `window.location.reload()` tam sayfa yenilemesi ses açma tercihini de sıfırlıyordu. Fix: `refetchWaiterPanel` server action'ı ile incremental state refetch (abonelik SUBSCRIBED olur olmaz + 5sn'lik D30 polling) tam reload'ın yerini aldı. chromium-desktop'ta tutarlı geçiyor; mobile-safari'de ayrı/ilgisiz bir zamanlama kırılganlığı (misafir tarafındaki "Garson çağrıldı." toast'ı, bu fix'in dokunmadığı bir kod yolu) hâlâ ara sıra retry'de geçiyor — `admin/ingredients-recipe.spec.ts` ile aynı bilinen webkit deseni, kapsamı bu maddenin dışında
- [ ] `admin/ingredients-recipe.spec.ts` (S34, yalnızca mobile-safari) — "Süt" malzeme eklendikten sonra listede görünmesi zaman zaman gecikiyor (retry'de geçiyor, webkit'e özgü olabilir) — kök neden netleşmedi

## Faz 20 — Demo Menü Şablonu Görsel Kalitesi (D85 takibi)
- [ ] 48 stok fotoğrafını AI üretimi görselleriyle değiştir (GEMINI_API_KEY + `google-genai` paketi kurulunca)
- [x] `_templates/*` görsellerini local Supabase Storage'dan prod Supabase Cloud'a senkronize et (2026-07-28) — 48/48 başarıyla senkronize edildi, canlıda erişilebilir

## Faz 21 — Frontend Yeniden Tasarımı (Design System + 3 Tema)
81 sayfa / 9 route grubu / 41 bileşenin görsel dili dağınık ve tutarsız. D88 ile tema mimarisi üç katmana ayrılıyor (tenant teması yalnızca misafir yüzeyini boyar), `warm-luxury`/`sage-bistro` emekliye ayrılıp yerlerine **Gece / Kâğıt / Kor** geliyor. Görsel yön ve token sistemi kökteki `DESIGN.md`'de. Strangler kuralı (RULES #22): eski bileşenler yeni sistem o yüzeyi devralana kadar silinmez; her Adım sonunda uygulama çalışır durumda.

**Faz kabul kriterleri (tüm Adım'lar için geçerli):** token sızıntısı yok (tenant token'ı `data-surface="app"` altında, RKYS ürün token'ı `data-surface="guest"` altında hiç eşleşmez — lint + tip + E2E ile yakalanır) · hardcoded renk/metin yok (RULES #11/#13) · `any`/`@ts-ignore` yok (RULES #9) · uydurma iddia/sayı/logo/testimonial yok (bölüm gerekiyorsa kaldırılır, uydurulmaz) · her animasyon `prefers-reduced-motion: reduce` altında sadeleşir · kontrast AA + Kâğıt gövdesinde AAA · `getByRole` + accessible name yüzeyi korunur, test silinmez/skip'lenmez (RULES #44).

- [x] **Adım 0 — Tema mimarisi + design system + shell + QR menü dikey dilimi** *(2026-08-03 tamamlandı)*
      Blocked by: Yok — hemen başlanabilir
      Kapsam: **(önkoşul)** `next.config.ts`'e `images.remotePatterns` eklenir, `product-card.tsx`'teki `unoptimized` kaldırılır — bu yapılmadan LCP bütçesi tutmaz · **token katmanı** (`:root` marka primitifleri + 2a pazarlama + 2b app ± light + üç tenant teması; `data-surface` `proxy.ts`'te pathname'den header ile, `data-mode` **cookie**'den — localStorage değil, ilk boyamada flaş olmasın; hareket/yoğunluk/tipografi de token'lanır, eksik token derleme/lint hatası verir) · **primitive katmanı** (kullanım sıklığına göre: button 68, card 53, input 34, label 32, badge 26, select 24, switch 16, textarea 9 yeniden yazılır; dropdown-menu/sheet/accordion taşınır; `separator` (0 kullanım) silinir) · **shell katmanı** (route grubu başına layout; admin §2.3'e göre iki kolon, gruplanmış+aranabilir nav; modül/izin mantığı `src/lib` + `nav-items.ts`'ten **tüketilir, yeniden yazılmaz**) · **tema geçiş migration'ı 0090 (AYRI COMMIT)** · **dikey dilim:** `(menu)/masa` → kategori → ürün → sepet → sipariş → durum akışı **üç temada da** yeni tasarıma taşınır.
      Kabul kriterleri: (1) üç tema aynı bileşen setini kullanır, tema başına ayrı bileşen yok · (2) **görselsiz kanıt** — hiç fotoğrafı olmayan menü üç temada da ekran görüntüsüyle kanıtlanır; her tema kendi `--placeholder` token'ını tanımlar (`--card-2`'den türetilmez); bir kategoride fotoğraflı ürün oranı %50'nin altındaysa **o kategori tamamen** metin öncelikli düzene geçer; görselli/görselsiz fark CLS üretmez · (3) **boş/hata durumları tasarlanır** — ürünsüz menü, tamamı tükenmiş kategori, boş sepet, **bağlantı kesintisi göstergesi (D30)** · (4) **durum hareketi** — sipariş durum geçişi, sepet sayacı artışı, bağlantı durumu değişimi animasyonla anlatılır; yalnızca giriş/stagger yeterli değil · (5) menü ızgarası Server Component kalır, giriş animasyonu CSS; framer-motion yalnızca etkileşimli yaprakta; ızgarada `layout` animasyonu yasak · (6) dokunma hedefi ≥44px (`@media (pointer: coarse)` altında yoğunluk token'ı genişler) · (7) `:focus-visible` tüm etkileşimli öğelerde · (8) `/masa` first-load JS ≤390 KB gzip (Faz 21 öncesi 488; 300 KB hedefi Sentry ortak tabanda kalırken matematiksel olarak ulaşılamıyordu — bkz. D89 revizyonu), LCP ≤2.5s, INP ≤200ms, CLS ≤0.05 · (9) token izolasyon testi: admin'de tema değişimi `--primary`'yi değiştirmez.

- [x] **Adım 1 — `(admin)` + `(platform)` + `(analytics)`** *(2026-08-03 tamamlandı)*
      Blocked by: Adım 0
      Kapsam: 33 admin + 13 platform + 1 analytics sayfası yeni shell ve primitive'lere taşınır. Sayfa header deseni (eyebrow + başlık + meta/aksiyon satırı) 33 sayfanın tamamında tek tip. İstatistik kartı + kanban kolonu desenleri. Mevcut 6 analitik widget'ı recharts ile kalır — **yeni grafik kütüphanesi eklenmez**.
      Kabul kriterleri: her ekran **koyu ve açık modda** doğrulanır · uppercase etiketlerde taban 11px, tablo gövdesinde 12.5px · tablo satırında hover + `:focus-visible` · tablette gerçek kullanım · `can()` ve modül kapama server tarafında korunur (RULES #34/#41) · `admin-nav.spec.ts` sidebar'a eklenen arama input'una karşı doğrulanır.
      **Kapanış notu (2026-08-03):** 36 dosyada başlık deseni tek tipe alındı (eyebrow nav grubundan türetiliyor, yeni i18n dizesi yazılmadı). `(platform)` admin'le aynı shell'e taşındı. **`/analytics` hiçbir yerden linklenmiyordu** — Faz 5'in tamamı erişilemezdi, nav'a eklendi. Hardcoded palet sınıfı sıfıra indi (RULES #13). Ters yönde bir token sızıntısı kapatıldı: `--font-heading` global olarak Fraunces'e bağlıydı, admin başlıkları serif çıkıyordu. Mockup'a bakıp varsaydığım "tablo yoğunluğu" işi iptal edildi — kod tabanında `<table>` kullanan tek admin dosyası var. Kapanış koşumu: 56 geçti / 6 kırık; **altısı da `git stash` ile HEAD'de de kırık olduğu doğrulanmış eski bakım borcu** (Faz 19 listesi), bu Adım'ın regresyonu değil.

- [ ] **Adım 2 — `(marketing)` anasayfa + alt sayfalar**
      Blocked by: Adım 1
      Kapsam: §2.4'ün 8 bölümlük iskeleti (nav → hero → entegrasyon şeridi → modül vitrini → bölünmüş içerik → fiyatlandırma → kapanış CTA → footer) + `/sss` `/iletisim` `/gelistirici` `/donanim` `/blog` `/legal/*` `/kayit`. TR + EN.
      Kabul kriterleri: fiyatlar `plans`/`plan_modules`'tan gerçek ₺ (HTML'e gömülmez) · **iki satış modeli** (plan bazlı SaaS + lifetime/self-hosted lisans) eşit görünürlükte · 15 modül vitrini ölçeklenir (kart başına farklı pastel tint kullanılmaz) · **istatistik şeridi, müşteri logosu ve testimonial bölümü sayfada hiç yer almaz** · `(marketing)/layout.tsx`'teki `warm-luxury` debug rozeti kaldırılır ve `app-boots.spec.ts`'in ilgili assertion'ı marka adına daraltılır.

- [ ] **Adım 3 — `(waiter)` + `(kitchen)` + `(cashier)` + `(courier)`**
      Blocked by: Adım 2
      Kapsam: operasyon panelleri; kanban deseni KDS istasyon panosuna ve sipariş durum makinesine uygulanır.
      Kabul kriterleri: yoğun, hızlı, **uzaktan okunabilir** · tablet/büyük ekran birincil · okunabilirlik estetiğe feda edilmez · ısrarcı ses/bağlantı göstergesi davranışı korunur (D28/D30).

---

## Çalışma Prensipleri
1. Faz başında plan sun → onay → uygula; faz sonunda migration+seed güncel, akış elle test edilmiş.
2. RLS izolasyon testi her yeni tabloyla; izin bayrağı ve modül-kapama testleri her yeni modülle.
3. Tamamlananlar burada işaretlenir; mimari değişiklik önce ARCHITECTURE + DECISIONS.
