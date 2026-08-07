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

- [x] **Adım 2 — `(marketing)` anasayfa + alt sayfalar** *(2026-08-03 tamamlandı)*
      Blocked by: Adım 1
      Kapsam: §2.4'ün 8 bölümlük iskeleti (nav → hero → entegrasyon şeridi → modül vitrini → bölünmüş içerik → fiyatlandırma → kapanış CTA → footer) + `/sss` `/iletisim` `/gelistirici` `/donanim` `/blog` `/legal/*` `/kayit`. TR + EN.
      Kabul kriterleri: fiyatlar `plans`/`plan_modules`'tan gerçek ₺ (HTML'e gömülmez) · **iki satış modeli** (plan bazlı SaaS + lifetime/self-hosted lisans) eşit görünürlükte · 15 modül vitrini ölçeklenir (kart başına farklı pastel tint kullanılmaz) · **istatistik şeridi, müşteri logosu ve testimonial bölümü sayfada hiç yer almaz** · `(marketing)/layout.tsx`'teki `warm-luxury` debug rozeti kaldırılır ve `app-boots.spec.ts`'in ilgili assertion'ı marka adına daraltılır.
      **Kapanış notu (2026-08-03):** 8 bölümlük iskelet uygulandı; modül sayısı `MODULE_KEYS.length`'ten geliyor (elle yazdığım "15" yanlıştı, gerçek sayı 16 — dinamikleştirildi). Lisans modeli kendi bölümünde, fiyatlandırmayla aynı ağırlıkta; lisans fiyatı uydurulmadı. **Bülten formu eklenmedi** — arkasında çalışan abonelik ucu yok, çalışmayan form olmayan formdan kötü. Alt sayfaların 6 başlığı display fontuna hizalandı.
      **Takip maddesi:** hero ve bölünmüş bölümlerdeki ürün gösterimi şu an ürünün gerçek token'larıyla çizilen bir CSS bileşeni (`product-mockup.tsx`). §2.4 gerçek ekran görüntüsü istiyor; denendi ama yerel demo verisi E2E koşumlarıyla kirlendiği için (kategori/ürün tekrarları) kullanılabilir görüntü çıkmadı. Temiz demo veri sağlanınca PNG ile takas edilecek.

- [x] **Adım 3 — `(waiter)` + `(kitchen)` + `(cashier)` + `(courier)`** *(2026-08-03 tamamlandı)*
      Blocked by: Adım 2
      Kapsam: operasyon panelleri; kanban deseni KDS istasyon panosuna ve sipariş durum makinesine uygulanır.
      Kabul kriterleri: yoğun, hızlı, **uzaktan okunabilir** · tablet/büyük ekran birincil · okunabilirlik estetiğe feda edilmez · ısrarcı ses/bağlantı göstergesi davranışı korunur (D28/D30).
      **Kapanış notu (2026-08-03):** dört panel ortak `src/components/ops/` kabuğuna alındı (`OpsShell` / `OpsBoard` / `OpsColumn` / `OpsCard` / `OpsBadge` / `OpsConnection`). KDS düz kart ızgarasından **durum bazlı kanban**a geçti (`approved → preparing → ready`), kolon başlığı yapışkan ve sayaçlı. **Fiş yaşlanması eklendi:** `StaffOrderView.createdAt` zaten geliyordu ama hiçbir yerde gösterilmiyordu — KDS'nin en değerli tek sinyaliydi; 10 dk `--sem-warn`, 20 dk `--sem-err`. Süre `useSyncExternalStore` ile tek bir interval'den besleniyor, sunucu anlık görüntüsü `0` döndüğü için hidrasyon uyumsuzluğu üretmiyor. Garson paneli iki kolona ayrıldı ve çağrı kartı tek satıra indi (geniş kolonda tam genişlik buton yer israfıydı). `.ops-surface` dokunma hedefini **işaretçi türünden bağımsız** 44px'e sabitliyor — duvara asılı bir KDS fare ile de kullanılıyor. Kurye paneli bilinçli olarak kanban **değil** (telefonda kolon yalnızca kaydırma ekler). Kasa chrome'u aynı ölçeğe alındı, PIN pad tablet için büyütüldü. Davranış sözleşmesi (§5) korundu: `data-slot="card"`, KDS'de tek `combobox`, masa-taşı satırının etiket/seçici komşuluğu, POS ürün satırının `.locator("../..")` iç içeliği.
      **Faz 21 kapanış koşumu (2026-08-03/04):** `tsc --noEmit` temiz · `lint` temiz · **unit 47/47** · **integration 438/438** (DB reset + seed genişletmesi sonrası; öncesinde 10 kırıktı, hepsi veri kirliliğiydi) · **E2E production build üzerinde 149 geçti / 18 kırık / 16 flaky**.

      **18 E2E kırığının tamamı atfedildi — Faz 21 regresyonu YOK.** 11 ayrı test kimliği:
      - **7'si Faz 19'dan devreden bakım borcu** (`admin-nav:28`, `table-qr-flow:56`, `registration-approval:45`, `tenant-suspend:23`, `app-boots:14`, `tenant-flows:36`, `waiter-pin-login:39` — sonuncusu `git stash` ile HEAD'de 3/3 kırık doğrulandı).
      - **2'si E2E'nin kendi kirliliği, ikisi de kaynağında düzeltildi:** `menu-reorder:5` acme'de biriken 9 aktif kategoriden 7'si `menu-crud`'un artığı olduğu için kırılıyordu (çöp silinince 2.4sn'de geçti → `menu-crud`'a `afterAll` temizliği eklendi); `session-panel:49` KDS'de biriken 116 açık sipariş yüzünden kırılıyordu (temizlenince geçti).
      - **2'si `mobile-safari` hidrasyon yarışı** (`ingredients-recipe:61`, `staff-scheduling:39`). **Mekanizma kanıtlandı:** `/kayit` formunda sayfa yüklendikten sonra 0 ms beklenince **0 POST** gidiyor, 3000 ms beklenince akış sorunsuz tamamlanıyor. Playwright, WebKit hidrasyonu bitmeden tıklıyor ve tıklama yutuluyor — ürün hatası değil, bekleme stratejisi sorunu (takip maddesi 2).

      **Demo veri genişletmesi (2026-08-03, kullanıcı isteği):** yerel DB `supabase db reset` ile sıfırlandı (E2E kirliliği: 27 tenant'ın 24'ü `test-*`, acme'de 182 sipariş) ve seed 3 katına çıkarıldı — acme kategori 2→6 / ürün 3→16 / varyant 2→7 / ekstra 2→7 / masa 6→13 / bölge 2→3 / rezervasyon 2→6 / malzeme 2→8 / tedarikçi 1→3 / müşteri 1→5 / vardiya 2→6 / teslimat bölgesi 1→3 / reçete 0→4; beta kategori 1→2 / ürün 1→5; gamma dokunulmadı (taze onboarding demosu). Ad tekrarı sıfır (gamma'nın ürünü acme ile aynı addaydı → "Gamma Kahve"). Blok tamamen ekleyici: mevcut id/ad/`display_order` değişmedi, `Filtre Kahve` bilerek varyantsız bırakıldı. **İsimlendirme kısıtı:** yeni masalar "Masa 10+" değil "Bahçe/Teras N" — Playwright `getByRole(name:"Masa 1")` alt dize eşliyor. Seed sayısına bağlı 5 RLS assertion'ı güncellendi; izolasyon assertion'ları değişmedi. Integration reset+genişletme sonrası **438/438**.

      **Bu Adım'da bulunan iki eski hata (düzeltildi):**
      - `menu-reorder.integration.test.ts` acme'nin GERÇEK kataloğunu yeniden sıralayıp öyle bırakıyordu — `pnpm test:integration` sonrası demo menüde Tatlılar içeceklerin önüne geçiyordu. Dosyanın kendi `afterAll` temizlik desenine seed sırasının geri yüklenmesi eklendi.
      - `/admin/menu`'de hidrasyon uyumsuzluğu: dnd-kit `DndContext`'e `id` verilmediğinde kendi artan sayacını kullanıyor (sunucu `DndDescribedBy-0`, istemci `-54`); sürükleme tutamağının `aria-describedby`'ı yanlış öğeyi gösteriyordu. `useId()` ile çözüldü. Faz 5'ten beri duruyordu.

      **Faz 21 takip maddeleri (kapsam dışı, ayrı ele alınacak):**
      1. **E2E paketi `pnpm dev`'e karşı koşuyor ve asıl kırılganlık kaynağı bu — ÖLÇÜLDÜ.** Dev sunucusu route'ları istek anında derliyor; 5 worker × 2 proje altında `page.goto` 45sn'yi aşıyor ve `retries: 2` bile emmiyor.

         | Ortam | Kırık |
         |---|---|
         | `pnpm dev`, 5 worker | 44 |
         | `pnpm dev`, 2 worker | 21 |
         | `pnpm dev`, 1 worker (nokta atışı) | çoğu geçiyor |
         | `next build` + `next start` | önceki 6 kırığın 5'i geçti |

         En çarpıcı tekil ölçüm: `trial-subscription.spec.ts:60` dev'de 45sn'de timeout oluyordu, prod build'de **2.2 saniyede** geçti.

         **Öneri (karar kullanıcının):** `playwright.config.ts` → `webServer.command` `pnpm dev` yerine `pnpm build && pnpm start`. Maliyeti bir kerelik build süresi; kazancı, koşumun gerçek ürün davranışını ölçmesi ve derleme gecikmesinin tamamen kalkması. `reuseExistingServer: true` korunursa yerel geliştirmede dev sunucusu açıkken de çalışmaya devam eder.
      2. **E2E hidrasyon yarışı** — `mobile-safari`'de bazı senaryolar react-hook-form formuna hidrasyondan önce yazıp/tıklayarak kırılıyor (`kitchen-station-filter` HEAD'de 3/5). Bekleme stratejisi sorunu; Faz 19 bakım borcu.
      3. **`webhooks.integration.test.ts` üçüncü partiye bağımlı** — `https://httpbin.org/post`'a gerçek istek atıyor; o servis 503 verdiğinde test kırılıyor (bu oturumda gözlendi). Yerel bir mock uca taşınmalı.
      4. `themes` tablosunun asimetrik GRANT'i (0052): `service_role` yazabiliyor ama okuyamıyor.
      5. ~~`menu-crud` E2E'si acme'de kategori/ürün bırakıyor~~ — **düzeltildi** (2026-08-04): `afterAll` temizliği eklendi, koşum sonrası acme kategori sayısı seed'deki 6'ya dönüyor. Kalan benzer risk: `session-panel`/`pos-order` gibi spec'ler acme'de **açık sipariş** bırakıyor; KDS panosu zamanla doluyor.

## Faz 22 — QR Menü Kullanılabilirliği ✅
*Geriye dönük kayıt (2026-08-04): bu iş 2026-08-03/04'te yapıldı ve kodda `Faz 22` olarak etiketlendi (`menu-search.tsx`, `product-interactive.tsx`, `globals.css:153`, `seed.sql:681`), ancak PLAN.md'ye hiç yazılmamıştı. Tek doğru kaynak PLAN.md olduğu için buraya alındı.*

Faz 21 menüyü görsel olarak yeniledi ama kullanılabilirliğini değil. Kullanıcı geri bildirimi: "arayüz güzel ama kullanıcı dostu bir arayüz haline henüz gelmemiş." Ölçülen altı eksik ve kapanışları:
- [x] **Telefonda iki sütun + yatay kaydırma** — `scrollWidth 641` / viewport `412`. Kök neden: `body` kolon-flex; `main`'in `mx-auto`'su çapraz eksende `stretch`'i iptal edip genişliği `fit-content`'e düşürüyordu, kategori şeridinin `max-content`'i de genişliği belirliyordu (`overflow-x-auto` bu yüzden hiç devreye girmiyordu). Dört `(menu)` sayfasında `main`'e `w-full` eklendi. Ürün kartı telefonda **satır**, `sm:`ten itibaren kart — geçiş salt CSS, Server Component korundu.
- [x] **Ürün açıklaması hiç gösterilmiyordu** — veri zaten vardı (`content_translations.field='description'`), sorgu yalnızca `name` çekiyordu. `.in("field",["name","description"])`'a çevrildi; seed'e 43 açıklama satırı eklendi.
- [x] **Arama + "yalnızca stokta olanlar" filtresi** — sunucuya gitmez, kartları client'a taşımaz: eşleşme hesabı saf, DOM'a dokunmak tek `useEffect`. `useDeferredValue` ile INP korundu.
- [x] **Kart üstünde adet stepper'ı** (`− 2 +`) ve **fotoğrafa dokununca ürün detay katmanı** (büyük görsel, açıklama, varyant/ekstra, canlı toplam).
- [x] **Ses kilidi otomatik açılıyor** — "Sesi Aç" butonu kaldırıldı. Tarayıcı politikası bir kullanıcı hareketi ister ama **belirli bir buton** istemez; ilk `pointerdown`/`keydown`/`touchend`'de modül düzeyinde açılıyor. Buton hem yer kaplıyor hem içeriğin üstüne biniyordu.
- [x] **Gerçek ürün fotoğrafları** — 21 adet CC0/PDM görsel internetten seçildi (AI üretimi değil, logosuz); Playwright ile kontakt sayfası render edilip görsel olarak elenerek. Kaynak künyesi `supabase/seed/images/CREDITS.md`, yükleme `scripts/seed-images.mjs`.

## Faz 23 — Admin Paneli: Duyarlılık, Pano ve Tablolar
Kullanıcı talebi (2026-08-04): işletme admin hesabında taşma/sığmama var; pano boş; uygun yerlerde işlevsel tablo yok.

**Ölçüm (2026-08-04, `scripts/responsive-audit.mjs`, 22 sayfa × 390/768px):** belge düzeyinde yatay taşma **hiçbir sayfada yok** — kusur satır içi **kırpılma**. `/admin/ingredients` 308px kutuda 508px içerik, `/admin/tables` 324px kutuda 455px, `/admin/settings` 286px input'ta 1073px değer. Ata `overflow-hidden` olduğu için kaydırma da yok: telefonda bir masanın QR'ını yenilemek **imkânsız**, buton çizilmiyor. `/admin/tables`'ta 40px altında 157 dokunma hedefi. Gerçek bindirme (`overlap`) çıkmadı. Kök neden tek: satırlar `flex justify-between` ile masaüstü için yazılmış, `flex-wrap`/`min-w-0` yok.

**Kabul kriterleri:** ölçüm aracı 22 sayfada temiz · kırpılan içerik sıfır · dokunma hedefi kaba işaretçide ≥40px · panodaki her sayı gerçek sorgudan (uydurma yok, veri yoksa açık boş durum) · kapalı modülün istatistiği çizilmez, izin yoksa gösterilmez · E2E locator sözleşmeleri korunur, test silinmez/skip'lenmez (RULES #44).

- [x] **Adım 1 — `DataTable` primitifi.** Gerçek `<table>` + sıralama + filtre + yapışkan başlık; `sm` altında **aynı DOM** CSS ile etiketli karta dönüşür (`td::before { content: attr(data-label) }`). Yeni bağımlılık yok. Yanına kaba işaretçide (`pointer: coarse`) dokunma hedefini ≥40px'e sabitleyen kural — masaüstü yoğunluğu DESIGN.md'deki gibi kalır. **Sonradan eklendi:** `expandedRow` (satır altı açılan panel) — malzeme alım/fire/sayım formları ve webhook teslimatları bunu kullanıyor.
- [x] **Adım 2 — Pano.** ① bugünün KPI şeridi (her kart ilgili rapora tarih parametresiyle gider) ② "şu an" paneli (dolu masa/toplam, bekleyen çağrı, mutfaktaki sipariş) ③ dikkat gerektirenler listesi ④ günün çok satanları ⑤ hızlı işlemler. Ayrıntı ve iki ölçüm tuzağı: D92.
- [x] **Adım 3 — Tablo dönüşümü.** tables (3 liste), ingredients, suppliers, staff cihazları, scheduling (2), reservations (2), campaigns (2), loyalty, gift-cards, delivery-zones, kiosk, marketplace, api-keys, webhooks, accounting (2), support + reports'un 6 sözde-satır bloğu — toplam **26 liste**. **Tabloya alınmadı (bilinçli):** settings (form), menu (sürükle-bırak sıralı liste), onboarding/billing, **personel üye listesi** (aşağıdaki açık maddeye bakın).
- [x] **Adım 4 — E2E kirliliğini kaynağında temizle + tam paket.** Tek bir global teardown (D93); Faz 21 takip maddesi 5 kapandı.

      **Kapanış notu (2026-08-04).** Üç istek gibi görünen talep tek kök nedene indi: admin listeleri `flex justify-between` ile masaüstü için yazılmıştı. `DataTable` üçünü birden çözdü — kırpılma bitti, tablolar geldi, işlevsellik (sıralama/filtre/sayaç) tabloyla birlikte geldi.

      **Ölçüm, önce ve sonra** (`scripts/responsive-audit.mjs`, 22 sayfa × 390/768px):

      | | Önce | Sonra |
      |---|---|---|
      | Kırpılan/erişilemeyen içerik | `/admin/ingredients` 308→508px, `/admin/tables` 324→455px | **0** |
      | Belge düzeyi yatay taşma | 0 (zaten yoktu) | 0 |
      | Bindirme | 0 | 0 |

      En somut kullanıcı etkisi: telefonda bir masanın QR'ını yenilemek **imkânsızdı** — buton hiç çizilmiyordu ve ata `overflow-hidden` olduğu için kaydırılamıyordu da.

      **Bu Adım'larda bulunan ve düzeltilen beş bayat/eksik nokta:**
      1. `table-qr-flow:5` — Faz 22'de ürün açıklamaları eklenince `getByText("Filtre Kahve")` iki öğeye düştü (ad + "…günlük demlenen filtre kahve." açıklaması). Açıklamanın ürün adını tekrar etmesi doğal içerik; düzeltilen locator'dı.
      2. `table-qr-flow:56` — Faz 19'dan beri kırıktı: `QR_TOKEN_ENCRYPTION_KEY` ayarlı **değilken** çıkan hata metnini bekliyordu, anahtar D86 ile eklendi.
      3. `admin-nav` ×3 — `getByRole` erişilebilir adı **alt dize** eşler; panonun hızlı işlem bağlantıları sidebar nav'ıyla çakıştı (`exact: true`). Ayrıca üst bardaki hesap düğmesi Faz 21'de rol yerine işletme adını yazar olmuştu, test 45 sn boyunca var olmayan bir düğmeyi bekliyordu.
      4. `stock-purchase-waste-count` — satırı `getByText("Un").locator("../../..")` ile DOM tırmanarak buluyordu.
      5. `menu-reorder.integration` deseninin devamı: `table-zones.rls.test.ts` acme'ye eklediği "Salon"u hiç toplamıyordu.

      **Faz 23 kapanış koşumu (2026-08-04):** `tsc --noEmit` temiz · `lint` temiz · **unit 47/47** · **integration 437/438** · **E2E 150 geçti / 5 kırık / 21 flaky / 1 atlandı / 2 koşmadı**.

      | Katman | Sonuç |
      |---|---|
      | `tsc --noEmit` | temiz |
      | `lint` | temiz |
      | unit | **47/47** |
      | integration | **437/438** (tek kırık `httpbin.org` erişilemezliğiydi; kapanış sonrası dış bağımlılık kaldırıldı → **438/438**) |
      | E2E | **150 geçti / 5 kırık** |
      | duyarlılık denetimi | **0 kusur** (22 sayfa × 390/768px) |

      **E2E kırıkları 14'ten 5'e indi ve chromium-desktop'ta HİÇ kırık kalmadı.** Kalan 5'in tamamı `mobile-safari` ve tamamı devreden bakım borcu: `tenant-suspend:23`, `app-boots:14`, `waiter-pin-login:39` (Faz 19), `kitchen-station-filter:71` ve `courier-live-location:43` (WebKit; kurye testi coğrafi konum izni istiyor).

      **Yeşile dönenler:** `tenant-flows:36` (bayat locator), `ratings:8` (0/4 → 3/3), `faq-and-contact:22`, `staff-scheduling:39` (Faz 19'dan beri kırıktı), `ingredients-recipe:61`, `session-panel:49`, `registration-approval:45`, `table-qr-flow` ×3.

      **Faz 23 açık maddeleri (kapsam dışı, karar kullanıcının):**
      1. ~~Personel üye listesi tabloya alınamadı~~ — **çözüldü** (2026-08-04, kullanıcı onayı): migration 0091 `profiles.full_name` ekledi, liste tabloya alındı ve düzenleyici satırın altına taşındı. Ad nullable (mevcut personel geçersiz kılınmadı), yeni personelde zorunlu. Ayrıntı: D94.
      2. `webhooks.integration.test.ts` hâlâ `httpbin.org`'a gerçek POST atıyor (Faz 21 takip maddesi 3). Bu koşumda servis erişilemezdi (ölçüldü: 15 sn'de HTTP 000) ve tek integration kırığı buydu. Yerel bir uca taşınması `pg_net`'in Postgres **container'ı** içinden çağrı yaptığı gerçeğini çözmeyi gerektiriyor (`host.docker.internal` taşınabilir değil).
      3. E2E paketi hâlâ `pnpm dev`'e karşı koşuyor (Faz 21 takip maddesi 1) — ölçümler ve öneri orada duruyor, karar kullanıcının.
      4. **`networkidle` BEDAVA BİR BEKLEME DEĞİL — iki ayrı şekilde zarar verdi.** (a) *Realtime abonelikli sayfalarda hiç bitmiyor:* `/cashier/order` Supabase realtime açtığı için ağ boşa düşmüyor, bekleme test timeout'una kadar asılı kalıyor (45sn'de de 90sn'de de kırıldı). (b) *Girişin hemen ardındaki sayfada davranışı değiştiriyor:* `waiter-pin-login`'e eklenince chromium'da **3/3 kırıldı** ve sunucu action'ı `forbidden` dönmeye başladı — bekleme sırasında oturum durumu testin altından değişiyor. Kaldırılınca 3/3 geçti. **Kural:** bu bekleme yalnızca form + server action olan STATİK sayfalarda ve eklendikten sonra HER İKİ tarayıcıda doğrulanarak kullanılır. Eklendiği 7 spec'in tamamı chromium'da yeniden koşturulup doğrulandı. — ölçüldü: `/cashier/order` Supabase realtime açtığı için ağ hiç boşa düşmüyor, bekleme test timeout'una kadar asılı kalıyor (45sn'de de 90sn'de de kırıldı). Kalan WebKit yarışları (`kitchen-station-filter`, `courier-live-location`) tam olarak böyle sayfalarda; onlara başka bir bekleme sinyali gerekiyor.

---

## Faz 24 — Pazarlama Ana Sayfası: Bölüm Sırası, Plan Vitrini ve Hareket
Kullanıcı talebi (2026-08-06): entegrasyon şeridi düzensiz ve çok yukarıda; "referanslar" bölümü yok; ana sayfada "Demo" planı görünüyor; sayfa animasyonsuz.

**Kabul kriterleri:** duyarlılık denetimi pazarlama sayfalarında temiz · uydurma iddia yok (marka/logo/sayı/testimonial) · vitrin ile satın alınabilirlik ayrı · hareket `prefers-reduced-motion`'a uyar ve desteklenmeyen tarayıcıda içeriği GİZLEMEZ · E2E locator sözleşmeleri korunur (RULES #44).

- [x] **Adım 1 — Entegrasyon şeridi: konum korundu, kutunun içi düzeltildi (D100).** İlk denemede şerit modül vitrininin altına taşındı; **kullanıcı geri istedi** — sayfadaki yeri doğruymuş, sorun kutunun içiydi. Yedi marka adı başlıkla aynı `flex-wrap` satırında yarışıyor, 390px'te düzensiz sarıp hizasız kalıyordu. Adlar kendi satırına ve başlığın biraz altına indi; dar ekranda eşit hücreli iki sütunlu ızgara, `sm`'den itibaren tek satır akışı. Tür grupları geri alındı. Bölüm SIRASI artık E2E'de doğrulanıyor (şerit modül vitrininin ÜSTÜNDE) — sessizce yer değiştiremesin.
- [x] **Adım 2 — "Kimler kullanıyor" bölümü.** Kullanıcı uydurma kafe/restoran markalarıyla bir "Referanslar" bölümü istedi; bu DESIGN.md'nin "uydurma iddia yasak" kuralıyla çakışıyordu ve seçenekler sunuldu. **Kullanıcı işletme TİPLERİ biçimini seçti** — altı tip (üçüncü nesil kahveci, fine-dining, pastane, bistro, bar, şubeli zincir), sıfır uydurma isim, kural değişmedi. Bir E2E testi bölümün sonradan referans/testimonial'a dönüşmesini engelliyor.
- [x] **Adım 3 — "Demo" planı vitrinden çekildi (D96).** `plans.is_public` (migration 0092). Ana sayfa yalnızca `is_public` planları gösterir, kayıt formu ve plan ataması TÜMÜNÜ gösterir. Süper Admin `/platform/plans`'ta plan başına anahtar + "Ana sayfada gizli" rozeti. Fiyat ızgarasının sabit `sm:grid-cols-3`'ü de kaldırıldı — plan sayısından türetiliyor (bir plan gizlenince ortada boşluk kalıyordu).
- [x] **Adım 4 — Hareket (D97).** Hero'da açılış animasyonu (`--enter-index` ile kademeli), bölümlerde kaydırmaya bağlı belirme, kart/CTA'larda hover yükselmesi. **Saf CSS, 0 KB JS** — sayfa Server Component kalsın diye IntersectionObserver sarmalayıcısı eklenmedi (DESIGN.md hareket politikası).

      **Bu Adım'larda ölçümle bulunan ve düzeltilen üç kusur:**
      1. **Hero maketi 8px taşıyordu** (`-right-2`): 390px'te sayfanın kenar boşluğunu yiyordu. Denetim 350→358px olarak yakaladı. Üst üste binme tasarımın kendisi, taşma değil.
      2. **Başlıktaki iki CTA satır ortasından kırılıyordu** ("Giriş Yap", "Ücretsiz Deneyin" iki satıra düşüp başlığı iki katına çıkarıyordu). `whitespace-nowrap` + giriş bağlantısı 640px altında gizlendi; bağlantı **kaybolmadı**, footer'ın "Kurumsal" sütununa eklendi.
      3. **Denetim aracının kendisi yanlış ölçüyordu.** `scripts/responsive-audit.mjs` masaüstü işaretçisiyle koşuyordu, oysa `min-height: 40px` kuralı `@media (pointer: coarse)` altında — araç ekranda 40px olan düğmeleri "28px" diye raporluyor, bu gürültü gerçek kusurları gizliyordu. `hasTouch: true` eklendi ve denetlenen küme CSS kuralının kapsadığı kümeyle **birebir** hizalandı (çıplak `a` dışarıda — kural da onu listelemiyor). Ayrıca yazarın bilinçli `overflow-x: auto`'su (kod blokları) kusur sayılmıyor. Sonuç: admin **26 → 0**, pazarlama **8 → 0** kusurlu koşum. Araç artık pazarlama sayfalarını da tarıyor (7 sayfa).

      **Faz 24 koşumu (2026-08-06):**

      | Katman | Sonuç |
      |---|---|
      | `tsc --noEmit` | temiz |
      | `lint` | temiz |
      | unit | **47/47** |
      | integration | **438/438** |
      | E2E (pazarlama) | **18/18** (mobile-safari'de 4 flaky — hepsi ilk denemede `page.goto` zaman aşımı, retry'da geçti) |
      | duyarlılık denetimi | **0 kusur** (7 pazarlama + 22 admin sayfası × 390/768px, dokunma emülasyonuyla) |

      **ÜRETİM OLAYI (2026-08-06, D99).** Adım 3'ün uygulama kodu `main`'e push edildi, `main` D83 gereği otomatik Vercel production'a çıkıyor — ama **migration 0092 üretim Supabase'ine gitmedi** (CI migration push etmiyor; `.github/workflows`'ta `supabase db push` yok). Olmayan kolona filtre → PostgREST hatası → `error` okunmadığı için boş liste → **ana sayfanın fiyat tablosunda tek plan kartı kalmadı.** Kullanıcı bildirdi, `curl` ile doğrulandı. İki hata birden düzeltildi: (1) sıralama — şemaya bağımlı kod şemadan önce deploy edildi; (2) dayanıklılık — `getMarketingPlans()` artık `error` durumunda filtresiz listeye düşüp log'luyor, bir E2E testi de fiyat tablosunun boşalmamasını koruyor. **Kalıcı kural:** şemaya bağımlı bir okuma eklerken ya migration ÖNCE üretime uygulanır ya da okuma kolonun yokluğuna dayanıklı yazılır — ve `data` ile birlikte `error` her zaman okunur.

- [x] **Adım 5 — Kayıtta ödeme kaldırıldı, trial'ın bitişi kapıya bağlandı (D101).** Açık madde 2'nin ("Demo varsayılan seçili") kullanıcıya dönen yüzü şuydu: "Ücretsiz Deneyin"e basan ziyaretçi ₺0'lık Demo planıyla checkout sayfasına düşüyordu. Kök sebep tek bir hata değil, **D18 ile D80'in çakışmasıydı** — kayıt akışı ödeme istiyor, ana sayfa "14 gün kartsız deneme" vaat ediyordu. Kullanıcı D18 yönünü seçti. Kayıt artık ödeme almıyor; ödeme `/admin/billing`'e taşındı; süper admin havale/EFT tahsilatını "Ödemesi alındı" ile işaretleyip tenant'ı pasiflikten çıkarabiliyor. Varsayılan plan seçimi `defaultSelectablePlanId`'ye çıkarıldı (aynı `plans[0]` hatası `/admin/billing` seçicisinde de vardı). Migration 0093.

      **ÜRETİM RİSKİ (2026-08-07) — D99'un birebir tekrarı, bu kez kendi elimizle.** Proxy kapısını ekleyen `739983b` `main`'e gitti ve D83 gereği otomatik production'a çıktı; migration 0093 ise üretim Supabase'ine uygulanmamıştı. O pencerede üretimdeki `resolve_tenant_by_domain` eski dönüş tipindeydi, `subscription_active` `undefined` geliyordu ve `!undefined === true` olduğu için kapı **istisnasız her tenant'ı** `/abonelik-gerekli`'ye çeviriyordu. Pencere ~37 dakika (15:29→16:06); geri alma commit'i (`9410730`) push'landı, kapı tamamen kalktığı için üretim artık 0093'ten bağımsız. **D99'un kalıcı kuralı yine ihlal edildi:** şemaya bağımlı kod, migration üretime uygulanmadan deploy edilmemeli. Kural yeterli değil çünkü uygulanması insana bağlı — kalıcı çözüm CI'ya `supabase db push` eklemek (ayrı iş, kullanıcı kararı).

      **Yanlış teşhis ve geri alma (aynı Adım içinde, 0095).** Plan "trial bitişi hiçbir kapıya bağlı değil" varsayımıyla proxy'ye bir abonelik kapısı ekliyordu. Varsayım yanlıştı: kapı **yüzey bazında zaten kuruluydu** (admin dashboard layout'u, waiter, kitchen, courier, analytics, cashierGuard → `/admin/billing`), yani kullanıcının istediği "girişte ödeme sayfasına yönlenme" davranışı çalışıyordu. Hatanın kaynağı arama: SQL adı `is_subscription_active` arandı, TypeScript tarafı `isSubscriptionActive` camelCase olduğu için hiç görünmedi. **Tam paket bunu yakaladı** — `trial-subscription.spec.ts` (S13) kırmızıya döndü ve testin kendi yorumu kararı yazıyordu: "Misafir menüsü hâlâ çalışmalı (S13 kararı: tam kilit değil)". Proxy kapısı, `/abonelik-gerekli` sayfası ve i18n'i geri alındı; `resolve_tenant_by_domain` 0095 ile 0085 hâline döndü. 0093'ün diğer iki fonksiyonu (`mark_subscription_paid`, `approve_tenant_on_registration`) gerçek boşlukları doldurduğu için yerinde kaldı.

      **Faz 24 açık maddeleri:**
      1. **Migration 0092 üretim Supabase'ine hâlâ uygulanmadı** — kullanıcı onayı bekliyor. Uygulanana kadar üretimde tüm planlar (Demo dahil) görünür; geri düşüş sayesinde tablo boş değil. Uygulandıktan sonra üretimdeki Demo planının `key`'i `demo` değilse Süper Admin'den "Ana sayfada göster" anahtarıyla kapatılır. **Migration 0093 + 0095 de aynı kuyrukta.** 0095, 0093'ün `resolve_tenant_by_domain` değişikliğini geri aldığı için ikisi birlikte uygulandığında resolver şeması hiç değişmez; sıra riski kalmadı. Uygulama kodunun ihtiyaç duyduğu tek yeni şey 0093'ün `mark_subscription_paid`'i — o uygulanmadan Süper Admin'deki "Ödemesi alındı" düğmesi hata verir (kayıt/trial akışı etkilenmez).
      2. ~~Kayıt formunda plan sırası `table_limit` artan — "Demo" varsayılan açılıyor.~~ **Adım 5'te kapatıldı (D101):** varsayılan artık ilk `is_public` plan; Demo listede kalıyor.

---

## Çalışma Prensipleri
1. Faz başında plan sun → onay → uygula; faz sonunda migration+seed güncel, akış elle test edilmiş.
2. RLS izolasyon testi her yeni tabloyla; izin bayrağı ve modül-kapama testleri her yeni modülle.
3. Tamamlananlar burada işaretlenir; mimari değişiklik önce ARCHITECTURE + DECISIONS.
