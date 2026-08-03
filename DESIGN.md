# DESIGN.md — RKYS Dashboard Tasarım Sistemi

> Faz 21 (2026-08-03) `/design-consultation` çıktısı. Görsel/UI kararı vermeden önce bu dosya okunur.
> Kaynak yön dosyası: `~/.gstack/projects/furkanilkbahar-rkys-dashboard/designs/faz21-20260803/secilen-yon.html`
> **Bu dosya bir öneridir** — Faz 21 spec'i (Aşama C) onaylanana kadar bağlayıcı değildir.

## Ürün Bağlamı
- **Ne:** Çok kiracılı, çok şubeli, modüler Kafe & Restoran Yönetim SaaS. Çekirdek = QR menü; diğer her yetenek tenant'ın açtığı bir modül (D38).
- **Kim için:** TR restoran / kafe / pastane **işletme sahibi** (teknoloji şirketi değil).
- **İki satış modeli:** plan bazlı SaaS aboneliği **ve** lifetime/self-hosted lisans. İkisi de eşit görünürlükte anlatılır.
- **Yüzey tipleri:** misafir menüsü (mobil-first), yönetim paneli (33 sayfa, masaüstü/tablet), operasyon panelleri (tablet, uzaktan okunur), pazarlama sitesi.

## Görsel Tez
> **Operasyon nötr, iştah renkli.**

Chrome yoldan çekilir. Renk yalnızca **anlam** taşıdığında (durum, uyarı, aktif nav, grafik serisi) veya **yemek** olduğunda görünür. Admin'de renk = durum; pazarlamada renk = ürün ekran görüntüsünün kendisi; misafir menüsünde renk = fotoğraf, UI ona çerçeve.

## Token Mimarisi — üç katman

Token kapsamlaması `<html>` üzerinde **iki eksende** yapılır; `data-surface` middleware (`src/proxy.ts`) tarafından enjekte edilir:

```html
<html data-surface="guest|app|marketing" data-theme="gece|kagit|kor" data-mode="dark|light">
```

| Katman | Seçici | Kapsam |
|---|---|---|
| **0 — Marka primitifleri** | `:root` | Petrol paleti, font aileleri, yarıçap ölçeği, hareket token'ları, anlam renkleri. 2a ve 2b paylaşır. |
| **1 — Tenant teması** | `[data-surface="guest"][data-theme="…"]` | Yalnızca misafir yüzeyi (`(menu)`). Üç tema. RULES #26 burada geçerli. |
| **2a — Pazarlama** | `[data-surface="marketing"]` | Açık zemin, beyaz kart, **gölgeyle** yükseklik, gradient/pastel tint serbest. |
| **2b — Uygulama chrome'u** | `[data-surface="app"]` (+ `[data-mode="light"]`) | Çift modlu, düz, nötr, **dolgu açıklığıyla** yükseklik, gölge yok. |

**Sızıntı yasak:** tenant token'ı `data-surface="app"` altında hiç eşleşmez, tersi de geçerli. Bu üç katmanda yakalanır: (1) lint — tenant tema dosyaları yalnızca `[data-surface="guest"]` ile başlayan seçici yazabilir; (2) tip — `TenantToken` ve `ProductToken` ayrı union'lar; (3) E2E — admin sayfasında `--primary`'nin tenant tema değerine eşit **olmadığı** doğrulanır.

**Neden `<html>`, sarmalayıcı `<div>` değil:** `dropdown-menu`, `select` ve `sheet` Base UI Portal kullanıyor → `document.body`'ye render oluyorlar. Token'lar route-group `<div>`'inde olsaydı her açılır menü nötr temaya düşerdi.

## Tipografi

| Rol | Aile | Gerekçe |
|---|---|---|
| Gövde / UI / **veri** | **Geist** | Zaten `next/font` ile kurulu (0 KB ek). `tabular-nums` — 33 admin tablosunda kuruş hizalaması bedava. |
| Display | **Fraunces** (variable, `opsz` + `WONK`) | Pazarlama hero'su + **üç tenant temasının da** ürün adları/başlıkları. SaaS pazarı sans-serif hero denizi; variable serif ayrışıyor. |
| Kod / mono | **Geist Mono** | Kurulu. |

**Fraunces üç misafir temasında da yüklenir** (seçilen yön C'nin tipografisini aldı) → her `(menu)` isteği ~28 KB font ödüyor. Bu bilinçli: karakter kazancı bütçe içinde kalıyor. `(admin)`/`(platform)` yalnızca Geist kullanır, Fraunces oraya inmez — tipografi de renk gibi yüzey bazında kapsamlanır.

⚠️ **Kilitlenmeden önce doğrulanacak:** Fraunces ve Geist'in **Türkçe glif kapsamı** (ğ ş ı İ ç ö ü — özellikle noktasız `ı` / noktalı `İ`) ve lisans durumu.

Ölçek (tema başına token): `--t-display` (aile), `--t-display-w` (ağırlık), `--t-display-tr` (tracking), `--t-display-s` (boyut), `--t-price-w`, `--dens` (yoğunluk çarpanı).

## Renk

**Marka:** petrol/teal. Tek vurgu. Üç tenant vurgusundan (amber, altın, kırmızı) **kasten ayrışır** — pazarlamada QR menü ekran görüntüsü gösterildiğinde marka chrome'u ürünle yarışmasın diye.

```
--brand-300 oklch(.78 .07 200)   koyu yüzeylerde vurgu
--brand-500 oklch(.58 .10 200)   orta
--brand-600 oklch(.52 .095 200)  açık yüzeylerde vurgu / dolu CTA
--brand-700 oklch(.44 .08 200)   çip metni
```

**Anlam renkleri** (yalnızca admin/operasyon): `--ok` `.62 .13 155` · `--warn` `.75 .14 75` · `--err` `.58 .19 22` · `--info` `.6 .11 240`. Dekoratif kullanım yok.

**Nötr eksen:** admin soğuk-nötr (h≈240), pazarlama sıcak kırık-beyaz (h≈90).

## Üç Tenant Teması

Üçü **aynı bileşen setini ve aynı düzeni** paylaşır; yalnızca token'lar değişir. **Tema başına ayrı bileşen yazmak yasak.**

| | **Gece** | **Kâğıt** | **Kor** |
|---|---|---|---|
| Zemin | neredeyse siyah, sıcak | krem / kırık beyaz | dokulu siyah |
| Vurgu | amber `oklch(.78 .155 65)` | altın `oklch(.52 .092 72)` | kırmızı `oklch(.615 .21 28)` |
| Yarıçap | `--r-xl` | `2px` | `--r-xs` |
| Yoğunluk | 1.0 | 1.4 (ferah) | 0.88 (sıkı) |
| Hedef | modern casual, akşam servisi | pastane, specialty kahve, fine dining | fast food, burger, restobar |

**Kor'da öğrenilen kısıt:** doygun kırmızı, siyah zeminde okunacak kadar açık **ve** üstünde beyaz metin taşıyacak kadar koyu olamıyor (her doygunlukta beyaz CTA metni ≈3.9:1'de takılıyor). Çözüm: `L .615` + **koyu** `--accent-fg` (`oklch(.17 .03 30)`) → 4.68:1.

## Erişilebilirlik

Hedef: **WCAG AA** genel + **Kâğıt gövde metninde AAA (7:1)** — o temanın varlık sebebi güneş altında okunmak.

Mevcut token setinde **63/63 kontrast kontrolü geçiyor** (ölçüldü). Yeni token eklendiğinde aynı kontrol koşulur.

## Yükseklik, Yarıçap, Yoğunluk

| | Pazarlama (2a) | Admin (2b) | Misafir (1) |
|---|---|---|---|
| Yükseklik | gölge | **dolgu açıklığı**, gölge yok | fotoğraf + kart yarıçapı |
| Yarıçap | kart 20px, buton pill, konteyner 28px | `--r-sm`, sistem geneli tek değer | tema token'ı |
| Yoğunluk | ferah | sidebar/tablo kompakt (12px tablo, 7px satır), ana tuval ferah | dokunma hedefi ≥36px (kiosk için ≥44px) |

## Hareket

Token'lı: `--dur-fast 120ms` · `--dur-base 200ms` · `--dur-slow 340ms` · `--ease-out cubic-bezier(.22,1,.36,1)` · `--move-sm 6px` · `--move-md 14px`.

`prefers-reduced-motion: reduce` altında süreler `.01ms`, mesafeler `0` olur; opaklık geçişi kalır. **Her animasyon bu kuralı destekler.**

Kütüphane politikası: `framer-motion` v12 kurulu, **yeni animasyon kütüphanesi eklenmez** (RULES #21). Menü ızgarasının giriş/stagger animasyonu **CSS** (`@starting-style` / keyframes) — 0 KB JS. framer-motion yalnızca gerçekten etkileşimli yaprakta (sepet çubuğu, ürün detay sheet'i). **Menü ızgarasında `layout` animasyonu yasak.**

## Performans Bütçesi (QR menü, `/masa`)

Ölçüm tabanı 2026-08-03: `/masa` **488 KB gzip** first-load JS; en hafif rota 238 KB (ortak taban). Sentry `@sentry/nextjs` ortak tabanda **129 KB gzip** — kullanıcı kararıyla her yüzeyde kalıyor, bütçe ona göre çizildi.

| Metrik | Bütçe |
|---|---|
| LCP | ≤ 2.5 s |
| INP | ≤ 200 ms |
| TBT | ≤ 400 ms |
| CLS | ≤ 0.05 |
| `/masa` first-load JS | ≤ 300 KB gzip |
| Above-the-fold görsel | ≤ 150 KB |

**Açık borç:** `product-card.tsx` `<Image unoptimized>` kullanıyor ve `next.config.ts`'te `images.remotePatterns` yok → next/image boru hattı tamamen atlanıyor. LCP bütçesi bu düzeltilmeden tutmaz.

## Görselsiz Dayanıklılık (kabul kriteri)

Tenant fotoğrafları telefonla çekilmiş, kötü ışıklı, farklı oranlı olacak; bazı ürünlerde hiç fotoğraf olmayacak (D85). **Üç tema da görselsiz zarif çökmeli:**
- En-boy oranı **her zaman** rezerve edilir → görselli/görselsiz fark CLS üretmez.
- Fotoğrafın yerini tutarlı bir placeholder alır (çapraz tarama dokusu + ürün baş harfi, display fontunda).
- Metin öncelikli düzene geçilir: ürün adı büyür, açıklama daha çok satır alır.

## Yasaklar (tasarım tarafı)

- **Uydurma sosyal kanıt yasak** — müşteri sayısı, uptime yüzdesi, puan, müşteri logosu, testimonial. Bunlar pazarlama sayfasında **boş state olarak bile yer almaz**; bölüm kaldırılır, uydurulmaz. Bir sayı veya marka adı yazılacaksa kaynağı sorulur.
- Hardcoded kullanıcı metni yok (RULES #11) — her metin next-intl'den.
- Hardcoded renk/stil yok (RULES #13) — her şey CSS-variable token'ından.
- Dekoratif avatar yığını yok; avatar yalnızca gerçek personel ataması olan yerlerde (garson, kurye, vardiya).
- 3D cam objeler, el çizimi doodle oklar, kesim (cut-out) ürün fotoğrafçılığı, ateş/kor parçacıkları — hepsi kapsam dışı.
- Referans setindeki **pazar yeri desenleri** alınmaz: konum seçici, mesafe, restoran puanı, restoran keşfi ve **Home/Map/Search/Profile alt sekme çubuğu**. RKYS'nin alt çubuğu sekme çubuğu değil: **sepet + garson çağır**.

## Seçilen Görsel Yön

**A kompozisyonu + C tipografisi + C yoğun admin** (2026-08-03, kullanıcı seçimi):
- **Misafir menüsü:** sınırlı kart ızgarası, pill kategori çipleri, fotoğraf çerçeve içinde (kötü fotoğrafa en dayanıklı kompozisyon).
- **Tipografi:** Fraunces üç temada da display fontu.
- **Admin:** yoğun ritim — 6 istatistik tek satır, 12px tablo, 7px satır dolgusu, yanında kanban paneli (KDS istasyon panosu ve sipariş durum makinesi bu yapıyı kullanacak).

## Karar Günlüğü

| Tarih | Karar | Gerekçe |
|---|---|---|
| 2026-08-03 | Tasarım sistemi oluşturuldu (`/design-consultation`) | Faz 21 frontend yeniden tasarımı |
| 2026-08-03 | Marka rengi petrol/teal | Üç tenant vurgusundan ayrışması gerekiyordu; TR pazarında sıcak tonlar doymuş |
| 2026-08-03 | Erişilebilirlik AA + Kâğıt gövdesinde AAA | Kâğıt'ın varlık sebebi gündüz/güneş altında okunmak |
| 2026-08-03 | Admin koyu birincil, açık tam doğrulanır | Tek görsel yönde kalibrasyon, QA yükü dengeli |
| 2026-08-03 | Kor `--accent-fg` koyu | Doygun kırmızı beyaz metinle AA tutturamıyor (ölçüldü) |
| 2026-08-03 | Sentry her yüzeyde kalıyor, bütçe yükseltildi | Kullanıcı kararı; izleme kaybı istenmedi |
