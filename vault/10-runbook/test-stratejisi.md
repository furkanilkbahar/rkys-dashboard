---
tags: [runbook, test, e2e, rls, ci]
ozet: "Katmanlar (Vitest/Playwright), faz kapanis kriteri, RLS test sablonu, bilinen test aciklari."
guncelleme: 2026-08-01
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

## Bilinen Test Aciklari (2026-08-01 itibariyle)
- `admin/ingredients-recipe.spec.ts` (S34, yalniz mobile-safari): ara sira gecikme, kok neden netlesmedi.
- Webhook entegrasyon testleri gercek `httpbin.org`'a bagimli, dis servis kirilganligi (uygulama kodu degil).

## Baglantili notlar
[[faz-kapanis-ve-onay-akisi]] · [[kesin-kurallar-indeksi]]
