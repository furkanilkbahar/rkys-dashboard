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

## Faz 3 — Kasa + Ödeme + İade/İkram + Temel Raporlar
- [x] **Kasa modülü:** vardiya aç/kapa, nakit sayım/fark, `cash_movements`, **POS-lite sipariş girişi**, gün sonu (`day_closures`)
- [x] iyzico online ödeme + webhook; Hesap İste bütünlüğü; **eşit bölüşme**; bahşiş çipleri (iyzico: sandbox anahtarı gelene kadar mock ile doğrulandı, gerçek adaptör kodu tamamlandı)
- [x] **İkram/indirim** (izin bayrağı + sebep kodu) + **tam iade** (online otomatik / kasa manuel)
- [x] Değerlendirme sistemi (garson puanlı + Google köprüsü)
- [x] Temel rapor seti + **manuel maliyet & marj raporu** + CSV export (Excel: UTF-8 BOM'lu CSV ile karşılandı; muhasebe API adaptörü ileri faz kapsamında — D61)

## Faz 4 — SaaS Katmanı
- [x] Süper Admin: tenant/şube, kullanım, **modül & plan-modül yönetimi**, duyurular (banner), 2FA zorunluluk anahtarı
- [x] Planlar: masa limiti + **dahil şube + ek şube ücreti** enforcement; 14g kartsız trial; iyzico abonelik (mock-first)
- [x] Lisans modülü (lifetime/self-hosted) + doğrulama API (tamamen offline, imzalı dosya)
- [x] Pazarlama sitesi (TR/EN, modüler anlatım) + kayıt akışı + yasal set (KVKK/çerez/sözleşme/veri silme)
- [x] **Destek ticket modülü** (tenant talep → Süper Admin kuyruğu)
- [x] **Status sayfası** + uptime izleme (OPERATIONS) — D72 sınırı: veri modeli + manuel giriş, gerçek 3.parti alerting production'a ertelendi

## Faz 5 — Analitik Merkezi
- [x] Widget dashboard (sürükle-bırak) + şube kıyası (`(analytics)/analytics`, 6 widget, kullanıcı bazlı kalıcı düzen)
- [x] Hedefler + anomali uyarıları (`daily_sales_summary` altyapısı) — gecelik pg_cron taraması, %30+ ciro düşüşünde uyarı
- [x] **Zamanlanmış e-posta/PDF raporları** — lib/email (mock-first, Resend adaptörü D72 sınırı: anahtar gelene kadar doğrulanmadı) + @react-pdf/renderer
- [x] Rol/izin bazlı rapor erişimi; dönem + geçen yıl karşılaştırmaları; kayıp-kaçak (sebep kodlu) raporu — `reports.loss` izni, iptal sebep kodu için `orders.cancel_reason_code_id` eklendi (onay UI'ı ayrı bir Faz 1 eksiği olarak not edildi)

## Faz 6 — Gelişmiş Ödeme + Kampanya + Tema/Self-Hosted
- [ ] **Kalem bazlı hesap bölme** + **kısmi iade** (ortak altyapı)
- [ ] **Pricing Rules motoru v1** + **kural bazlı kampanya/kupon** (kod üretimi, limitler)
- [ ] Mutfak **istasyon ekranları** aktivasyonu
- [ ] Tema yönetimi UI + 1 ek tema; **self-hosted paket** (docker-compose + lisans entegrasyonu)

## Faz 7 — CRM & Sadakat
- [ ] Telefon+OTP müşteri hesabı (KVKK onaylı) + müşteri kartları
- [ ] **Sadakat motoru:** damga/puan (tenant seçer) + kazanım/harcama akışları
- [ ] **Hediye kartı modülü** (bakiye muhasebesiyle)
- [ ] Sadakat/kampanya performans raporları

## Faz 8 — Stok Derinliği & Maliyet
- [ ] Malzeme + **reçete motoru** (satışta otomatik düşüm, ürün başına mod seçimi) + fire/sayım hareketleri
- [ ] Basit alım girişi + hareketli ortalama maliyet + kritik stok uyarıları + `suppliers`
- [ ] **Menü mühendisliği matrisi** (otomatik maliyetle) + aksiyon önerileri

## Faz 9 — Kanallar: Gel-Al & Paket
- [ ] `pickup` kanalı (hazır bildirimi + teslim kodu)
- [ ] `delivery`: adres/bölge/ücret/min sepet + **zamanlanmış sipariş**
- [ ] **Kurye modülü** (atama, yolda→teslim, gün sonu özeti)

## Faz 10 — API & Entegrasyonlar
- [ ] **Tenant API:** API key yönetimi + imzalı **webhooks** (retry'lı) + read-only API
- [ ] Yazma API'si → **pazar yeri adaptörü** (karma strateji D70: aracıyla çıkış → doğrudana kademeli geçiş; Yemeksepeti resmî Plugin başvurusu paralel yürür) → siparişler kanal etiketiyle KDS'e
- [ ] Muhasebe **API adaptörü** (örn. Paraşüt); ÖKC adaptör kapısı dokümantasyonu

## Faz 11 — Ek Modüller
- [ ] **Rezervasyon + bekleme listesi** (masa haritası entegre)
- [ ] **Kiosk modu** (menünün dokunmatik modu)
- [ ] **Vardiya planlama + puantaj** (çizelge, PIN giriş-çıkış, saat raporu, maaş exportu)

## Faz 12 — Gelecek Havuzu
Mobil uygulama + push · Donanım paketi (termal/mutfak yazıcısı, çekmece, barkod, ÖKC) · Canlı kurye takibi · Segmentli kampanya + İYS iletişim modülü · Kademe sadakat · Tam PO/tedarik · Özel rol oluşturma · Çoklu kur · Yardım Merkezi · SLA'lı kurumsal paket  *(Wi-Fi portalı kapsam dışı — D69)*

---

## Çalışma Prensipleri
1. Faz başında plan sun → onay → uygula; faz sonunda migration+seed güncel, akış elle test edilmiş.
2. RLS izolasyon testi her yeni tabloyla; izin bayrağı ve modül-kapama testleri her yeni modülle.
3. Tamamlananlar burada işaretlenir; mimari değişiklik önce ARCHITECTURE + DECISIONS.
