---
tags: [runbook, test, e2e, rls, ci]
ozet: "Katmanlar (Vitest/Playwright), faz kapanis kriteri, RLS test sablonu, bilinen test aciklari."
guncelleme: 2026-08-04
---

# Test Stratejisi

## Katmanlar ve Araclar
| Katman | Arac | Kapsam |
|---|---|---|
| Birim | Vitest | Saf fonksiyonlar: fiyat/KDV, sepet toplami, pricing rules, lisans dogrulama, `can()` mantigi |
| Entegrasyon | Vitest + lokal Supabase | RLS izolasyonu, siparis durum makinesi, stok dusumu, modul guard'lari |
| E2E | Playwright | Kritik kullanici akislari, gercek tarayicida (mobil viewport dahil) |

CI her PR'da tum paketi kosar; kirmizi testle merge yok.

## Faz Kapanis Kriteri (DoD)
1. Yeni ozelliklerin birim/entegrasyon testleri yazildi.
2. Ilgili E2E senaryolari Playwright'ta geciyor.
3. Onceki tum fazlarin testleri dahil paket yesil.
4. Sonuc sohbette ozetlenir; fazlar arasi gecis icin ayrica onay beklenmez (D79) — surecin GUNCEL hali icin bkz. [[faz-kapanis-ve-onay-akisi]].

## Kritik E2E Senaryolari
**Yasayan liste, 55+ senaryo (S1-S55), her fazda genisler — burada bilinckli olarak KOPYALANMADI (surekli buyuyen bir liste, kopya aninda bayatlar). Guncel tam liste [[TESTING]] dosyasinin surum gecmisinde (git) veya CI'da `tests/e2e/` altinda.** Ozet kapsam: QR siparis cekirdegi (S1-S6), modul/onboarding (S7-S8), kasa/odeme (S9-S11,S25-S26), plan/SaaS (S12-S15,S49-S55), stok/recete (S34-S37), kanallar (S38-S40), entegrasyonlar (S41-S44), ek moduller (S45-S48).

## RLS Izolasyon Testleri (zorunlu sablon)
Her yeni tablo icin: (1) A tenant'i B'nin satirini SELECT/UPDATE/DELETE edemez, (2) branch_id'li tablolarda yetkisiz sube erisimi engellenir.

## Kapsam Disi (bilincli)
%100 kapsama hedefi yok; hedef kritik akislarin korunmasi. Gorsel piksel-regresyon + yuk testi -> Faz 12 havuzu.

## Test Verisi Hijyeni (D93, 2026-08-04)
E2E paketi acme'nin **gercek demo verisine** yaziyor. Artiklarin somut zarari
olculdu: `menu-reorder` ve `session-panel` birikme yuzunden kiriliyordu,
`schema-and-seed` integration testinin dort beklentisi birden dusuyordu, pano
"60 aktif masa" gibi anlamsiz sayilar gosteriyordu.

Temizlik **tek noktada**: `tests/e2e/global-teardown.ts` (playwright.config
`globalTeardown`). Spec basina `afterAll` dagitmak yeni spec eklenince
unutulur; kendi verisini yaratan spec'ler (`menu-crud`) kendi temizligini
korur.

Kurallar:
- **Silme olcutu dar tutulur:** masa etiketinde 13 haneli `Date.now()`, tenant
  slug'inda `test-` oneki. Seed etiketleri ve seed tenant'lari (acme/beta/
  gamma) bu desenlerle asla eslesmez.
- **Yerel olmayan Supabase'e karsi teardown hic calismaz.**
- **Silinemeyen kayit arsivlenir:** `table_sessions.table_id` FK'si
  `ON DELETE RESTRICT` (siparis gecmisi degismez, RULES #36) — bir kez oturum
  acilmis masa silinemez, `is_active=false` yapilir.
- **Her cagrinin hatasi okunur.** Ilk surum bunu yapmadigi icin "47 masa
  silindi" diye rapor ederken hicbirini silememisti.
- Arsiv birikmesi kalici oldugu icin sayim tabanli assertion'lar **aktif**
  satirlara bakar (`tables.rls.test.ts`); sizinti ucunu `every(...)` korur
  (D90'daki ayrim).

## Bilinen Test Aciklari (2026-08-04 itibariyle)
- `admin/ingredients-recipe.spec.ts` (S34, yalniz mobile-safari): ara sira gecikme, kok neden netlesmedi.
- ~~Webhook entegrasyon testleri `httpbin.org`'a bagimli~~ — **cozuldu**
  (2026-08-04): hedef, ayni Docker aginda calisan bir edge function oldu
  (`supabase/functions/webhook-test-sink`, Kong uzerinden
  `http://kong:8000/functions/v1/webhook-test-sink`, `?status=` ile HTTP kodu
  secilir). `host.docker.internal` KULLANILAMAZ: istegi pg_net Postgres
  container'indan atiyor ve o ad yalnizca Docker Desktop'ta cozulur, CI ise
  ubuntu-latest. **Not:** edge function'lari `supabase start` mount ediyor —
  yeni bir function eklendikten sonra yereldeki yigin bir kez yeniden
  baslatilmali (`supabase stop && supabase start`; veri korunur).
- **`networkidle` realtime abonelikli sayfalarda kullanilamaz** (olculdu
  2026-08-04): `/cashier/order` Supabase realtime actigi icin ag hic bosa
  dusmuyor, `waitForLoadState("networkidle")` test timeout'una kadar asili
  kaliyor. Hidrasyon yarisi olan diger sayfalarda ise (form + server action)
  bu bekleme dogru cozum: `ratings` webkit'te 0/4 → 3/3 oldu.
- E2E paketi hala `pnpm dev`'e karsi kosuyor; prod build olcumu ve oneri
  [[PLAN]] Faz 21 takip maddesi 1'de, karar kullanicinin.

## Baglantili notlar
[[faz-kapanis-ve-onay-akisi]] · [[kesin-kurallar-indeksi]] · [[admin-tablolari-ve-pano]]
