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
- [ ] Menü şeması (layout+station, `track_mode`, `branch_product_overrides` temeli) + çeviri + basit stok
- [ ] Masa QR + genel QR (masa seçtiren) + imzalı oturum token
- [ ] Premium menü UI (varsayılan düzen, dil seçici, mikro animasyonlar)
- [ ] Sepet koruması + idempotency'li sipariş (channel=`dine_in`) + server-side stok kontrolü
- [ ] Durum makinesi + direct/approval + karma iptal; oturum yaşam döngüsü + **masa taşıma (personel)**
- [ ] Garson Çağır (tipsiz + tipler) + KDS + Garson paneli + ısrarcı sesler + bağlantı göstergesi
- [ ] Müşteri oturum görünümü + hazır ses/titreşim

## Faz 2 — Admin Panel + Onboarding
- [ ] Menü CRUD, drag&drop, çeviri editörü, kategori düzeni seçimi
- [ ] Görsel yükleme + otomatik optimizasyon + hazır kütüphane
- [ ] Masa/bölge + QR baskı şablonları (tema uyumlu, çoklu format)
- [ ] Personel (roller, PIN, cihaz yetkilendirme, **izin bayrakları UI**), garson profili
- [ ] Ayarlar: sipariş modu, timeout, çağrı tipleri, diller, para birimi, bahşiş çipleri, değerlendirme, tema, **Modül aç/kapa ekranı**
- [ ] Onboarding: demo veri (toplu temizleme) / sıfırdan kur (+**modül seçimi adımı**)

## Faz 3 — Kasa + Ödeme + İade/İkram + Temel Raporlar
- [ ] **Kasa modülü:** vardiya aç/kapa, nakit sayım/fark, `cash_movements`, **POS-lite sipariş girişi**, gün sonu (`day_closures`)
- [ ] iyzico online ödeme + webhook; Hesap İste bütünlüğü; **eşit bölüşme**; bahşiş çipleri
- [ ] **İkram/indirim** (izin bayrağı + sebep kodu) + **tam iade** (online otomatik / kasa manuel)
- [ ] Değerlendirme sistemi (garson puanlı + Google köprüsü)
- [ ] Temel rapor seti + **manuel maliyet & marj raporu** + CSV/Excel + **muhasebe uyumlu exportlar** (gün sonu)

## Faz 4 — SaaS Katmanı
- [ ] Süper Admin: tenant/şube, kullanım, **modül & plan-modül yönetimi**, duyurular (banner), 2FA zorunluluk anahtarı
- [ ] Planlar: masa limiti + **dahil şube + ek şube ücreti** enforcement; 14g kartsız trial; iyzico abonelik
- [ ] Lisans modülü (lifetime/self-hosted) + doğrulama API
- [ ] Pazarlama sitesi (TR/EN, modüler anlatım) + kayıt akışı + yasal set (KVKK/çerez/sözleşme/veri silme)
- [ ] **Destek ticket modülü** (tenant talep → Süper Admin kuyruğu)
- [ ] **Status sayfası** + uptime izleme (OPERATIONS)

## Faz 5 — Analitik Merkezi
- [ ] Widget dashboard (sürükle-bırak) + şube kıyası
- [ ] Hedefler + anomali uyarıları (`daily_sales_summary` altyapısı)
- [ ] **Zamanlanmış e-posta/PDF raporları**
- [ ] Rol/izin bazlı rapor erişimi; dönem + geçen yıl karşılaştırmaları; kayıp-kaçak (sebep kodlu) raporu

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
