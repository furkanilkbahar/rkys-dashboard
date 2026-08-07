---
tags: [mimari, saas, super-admin, plan, lisans]
ozet: "Super Admin yuzeyi: plan/abonelik, lisans, destek, status sayfasi, duyurular."
guncelleme: 2026-08-07
---

# SaaS / Platform Katmani

## Ne ise yarar
Platformu isleten taraf (biz): tum tenant'lari yonetme, faturalandirma, lisanslama.

## Nasil calisir
- **Planlar:** 3 plan (Baslangic/Pro/Sinirsiz), limit yalniz masa+sube sayisi, tum ozellikler her planda potansiyel acik (modul sistemiyle secilir). 14 gun kartsiz tam trial.
- **Plan gorunurlugu (D96):** `plans.is_public` "vitrinde mi" sorusunu "satin alinabilir mi" sorusundan AYIRIR. `getMarketingPlans()` yalnizca `is_public` olanlari gosterir (pazarlama ana sayfasi); `getPlans()` — kayit formu ve plan atamasi — TUMUNU gosterir ve bilerek filtresizdir. Demo/ic planlar bu sayede satin alinabilir kalip vitrinden cikar. Super Admin plan basina anahtarliyor.
- **Abonelik:** iyzico abonelik (mock-first, D72 siniri). **Lisans modulu:** lifetime + self-hosted (yillik), tamamen offline imzali dosya dogrulama (`lib/licensing`).
- **Kayit akisi (D80 + D101):** kapali-kapi — `/kayit` formu tenant'i dogrudan `active` acmiyor, `pending_approval` + `plan_id` ile aciliyor. `proxy.ts`'in `tenant_status !== 'active'` kapisi alt-domaini (admin/login dahil) kapali tutuyor. Onay: platform admin elle VEYA `platform_settings.auto_approve_registrations` (varsayilan kapali) — D101'den beri bu otomatik onay **kayit aninda** veriliyor (`approve_tenant_on_registration`), odeme webhook'unda degil. **D101: kayitta ODEME ALINMIYOR** (D80'in odeme parcasi iptal, D18 geri geldi); varsayilan plan secimi `defaultSelectablePlanId` ile ilk `is_public` plan, Demo listede kalir ama varsayilan degildir.
- **Abonelik kapisi (S13):** trial bitince kapi YUZEY BAZINDA kapanir — `(admin)/(dashboard)/layout.tsx`, waiter, kitchen, courier, analytics sayfalari ve `cashierGuard`, hepsi `isSubscriptionActive()` ile `/admin/billing`'e yonlendirir. **Misafir QR menusu ACIK KALIR** (bilincli: "tam kilit degil" — masadaki musterinin menusunu kapatmak isletmeyi degil misafiri cezalandirir). Kapi proxy'de DEGIL; D101'de proxy'ye ikinci bir kapi eklenmis ve geri alinmisti (0095), cunku hem ikizliyor hem misafir muafiyetini boziyordu. **Pasiflik saklanmiyor, turetiliyor**: `is_subscription_active()` her istekte hesaplanir, zamanlanmis gorev yok, odeme yapildigi an servis geri gelir. Havale/EFT icin `mark_subscription_paid` (D101, platform admin only, `provider='manual'`).
- **Super Admin paneli:** tenant/sube yonetimi, kullanim istatistikleri, plan CRUD + `plan_modules` (D81), tenant basina elle modul ac/kapa, 2FA zorunluluk anahtari, bakim duyurulari (banner).
- **Destek:** panel ici ticket modulu (tenant talep -> Super Admin kuyrugu, durum akisi).
- **Status sayfasi:** bilesen bazli durum + olay gecmisi + planli bakim banner'i (D72 siniri: veri modeli + manuel giris, gercek 3.parti alerting production'a ertelendi).

## Veri modeli
`tenants`, `plans`, `subscriptions`, `licenses`, `themes` + `tenant_themes`, `platform_payments`, `platform_settings`, `announcements`, `support_tickets` + `ticket_messages`.

## Ilgili kod
`src/app/(platform)/platform`, `src/lib/platform`, `src/lib/licensing`, `src/lib/subscriptions`, `src/lib/support`.

## Ilgili kararlar
D7 (Super Admin + lisans modelleri), D16-D18 (fiyatlandirma), D68 (plan taslagi), D80/D81 (kayit onayi + plan-modul modeli), D96 (plan vitrin gorunurlugu), D101 (kayitta odeme kalkti + abonelik kapisi). Detay: [[plan-modul-ekonomisi-kararlari]].

## Baglantili notlar
[[modul-sistemi]] · [[entegrasyon-adaptorleri]]
