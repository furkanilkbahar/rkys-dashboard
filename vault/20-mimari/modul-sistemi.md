---
tags: [mimari, modul-sistemi, urun-anayasasi]
ozet: "Dinamik Olceklenme Ilkesi: cekirdek QR menu, geri kalan her sey tenant'in actigi/kapattigi modul."
guncelleme: 2026-08-01
---

# Modul Sistemi (Dinamik Olceklenme)

## Ne ise yarar
Urunun anayasasi (D38): "sadece QR menu isteyen" ile "tam restoran yonetimi isteyen" ayni platformda hizmet gorur. Kapali modul HICBIR yuzeyde iz birakmaz.

## Nasil calisir
- **`tenant_modules`** feature-flag tablosu. Modul anahtarlari: `pos_cash`, `inventory`, `recipes`, `crm_loyalty`, `campaigns`, `gift_cards`, `pickup`, `delivery`, `courier`, `marketplace`, `reservations`, `kiosk`, `staff_scheduling`, `accounting_export`, `api_access`, `fiscal_integration`...
- **Tek kontrol noktasi:** `lib/modules/isEnabled(tenantId, moduleKey)` — navigasyon VE route guard bunu kullanir. Kapali modul: menude gorunmez, route 404/redirect, API 403 (RULES #34 — yalniz UI'da gizlemek yetmez).
- **Uc kaynakli modul modeli (D81):** `tenant_modules.source` bir modulun nereden geldigini ayirir — `plan` (plandan otomatik), `paid_addon` (ucretli, dusurmede asla dokunulmaz), `granted` (platform admin elle vermis / "Talep Et" onaylanmis).
- **Plan-modul sablonu:** `plan_modules` her planin varsayilan modullerini tanimlar; Super Admin `/platform/plans`'tan serbestce duzenler.
- **Dusurme incelemesi:** plan degisince plandan kaybolan modul hemen silinmez — `pending_removal_since` ile isaretlenir; platform admin Koru (`source='granted'`, kalici) veya Kaldir kararini `resolve_pending_module_removal` ile verir.
- **Talep Et akisi:** tenant plan disi modulu `request_module` ile ister, admin `resolve_module_request` ile onaylar/reddeder.

## Veri modeli
`tenant_modules`, `plan_modules`, `module_requests`, `module_addon_prices`, `plans`.

## Ilgili kod
`src/lib/modules/`, navigasyon guard'lari her route group'ta.

## Ilgili kararlar
D38 (ilke), D80 (kapali-kapi kayit onayi), D81 (uc kaynakli model + dusurme incelemesi), D63 (ek moduller plana alindi). Detay: [[plan-modul-ekonomisi-kararlari]].

## Baglantili notlar
[[saas-platform-katmani]] · [[sube-multi-tenancy]] · [[kimlik-rol-izin]]
