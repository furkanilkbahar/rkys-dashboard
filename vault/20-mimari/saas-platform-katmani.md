---
tags: [mimari, saas, super-admin, plan, lisans]
ozet: "Super Admin yuzeyi: plan/abonelik, lisans, destek, status sayfasi, duyurular."
guncelleme: 2026-08-01
---

# SaaS / Platform Katmani

## Ne ise yarar
Platformu isleten taraf (biz): tum tenant'lari yonetme, faturalandirma, lisanslama.

## Nasil calisir
- **Planlar:** 3 plan (Baslangic/Pro/Sinirsiz), limit yalniz masa+sube sayisi, tum ozellikler her planda potansiyel acik (modul sistemiyle secilir). 14 gun kartsiz tam trial.
- **Abonelik:** iyzico abonelik (mock-first, D72 siniri). **Lisans modulu:** lifetime + self-hosted (yillik), tamamen offline imzali dosya dogrulama (`lib/licensing`).
- **Kayit akisi (D80):** kapali-kapi — `/kayit` formu tenant'i dogrudan `active` acmiyor, `pending_approval` + `plan_id` ile aciliyor, odeme kok domainde (`/kayit/odeme`) aliniyor. `proxy.ts`'in `tenant_status !== 'active'` kapisi alt-domaini (admin/login dahil) kapali tutuyor. Onay: platform admin elle VEYA `platform_settings.auto_approve_registrations` (varsayilan kapali).
- **Super Admin paneli:** tenant/sube yonetimi, kullanim istatistikleri, plan CRUD + `plan_modules` (D81), tenant basina elle modul ac/kapa, 2FA zorunluluk anahtari, bakim duyurulari (banner).
- **Destek:** panel ici ticket modulu (tenant talep -> Super Admin kuyrugu, durum akisi).
- **Status sayfasi:** bilesen bazli durum + olay gecmisi + planli bakim banner'i (D72 siniri: veri modeli + manuel giris, gercek 3.parti alerting production'a ertelendi).

## Veri modeli
`tenants`, `plans`, `subscriptions`, `licenses`, `themes` + `tenant_themes`, `platform_payments`, `platform_settings`, `announcements`, `support_tickets` + `ticket_messages`.

## Ilgili kod
`src/app/(platform)/platform`, `src/lib/platform`, `src/lib/licensing`, `src/lib/subscriptions`, `src/lib/support`.

## Ilgili kararlar
D7 (Super Admin + lisans modelleri), D16-D18 (fiyatlandirma), D68 (plan taslagi), D80/D81 (kayit onayi + plan-modul modeli). Detay: [[plan-modul-ekonomisi-kararlari]].

## Baglantili notlar
[[modul-sistemi]] · [[entegrasyon-adaptorleri]]
