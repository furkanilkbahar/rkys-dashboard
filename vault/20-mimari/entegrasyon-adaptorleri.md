---
tags: [mimari, entegrasyon, adaptor, api, webhook, muhasebe, fiskal]
ozet: "Adaptor mimarisi: muhasebe/fiskal/pazar yeri/SMS saglayicilari + Tenant API/webhooks."
guncelleme: 2026-08-01
---

# Entegrasyon Adaptorleri & Tenant API

## Ne ise yarar
Dis sistemlere baglanma noktasi; saglayici degisse de cekirdek kod degismesin diye ortak arayuz.

## Nasil calisir
- **Adaptor deseni:** `lib/integrations/{delivery|accounting|fiscal|printer|sms|marketplace}` ortak arayuzler; somut saglayicilar (yemeksepeti, getir, parasut, escpos...) adaptor olarak eklenir.
- **Muhasebe:** admin tamamlanmis (`served`) siparisi manuel tetikler -> `AccountingProvider.syncOrderInvoice` (D61, su an yalniz mock) -> `accounting_sync_log`. CSV/Excel export'lar erken calisir durumda; dogrudan API adaptoru Faz 10'da eklendi.
- **ÖKC/fiskal (D61 -> D84):** gercek GIB sertifikasyonu bu kapsamda alinamiyor (mock-first'e genisletildi) — `lib/integrations/fiscal/{provider,mock,index}.ts`, `PaymentProvider` ile birebir ayni desende. `fiscal_integration` modulu aciksa her tamamlanmis odemede mock fis kesilir, `fiscal_receipts` tablosuna yazilir (best-effort, odemeyi asla bloklamaz). `get_fiscal_daily_summary` RPC'si.
- **SMS (D66):** adaptor mimarisi kesin (`lib/integrations/sms`), somut saglayici secimi kullanici gundeme getirdiginde yapilacak (oncelik degil).
- **Tenant API & Webhooks:** API key yonetimi + imzali webhooks (HMAC, tenant basina ayri anahtar) + read-only API (`/api/v1`); yazma API'si pazar yeri altyapisiyla ortak. Olay -> `webhook_deliveries` kuyrugu -> HMAC imzali POST -> basarisizsa ustel geri cekilmeli retry.

## Veri modeli
`api_keys`, `webhooks` + `webhook_deliveries`, `accounting_sync_log`, `fiscal_receipts`.

## Ilgili kod
`src/lib/integrations/`, `src/lib/webhooks`, `src/app/api/v1`, `src/app/api/webhooks`.

## Ilgili kararlar
D61 (muhasebe fazlari + ÖKC kapisi), D62 (Tenant API), D66 (SMS adaptoru), D84 (ÖKC mock-first genisletme). Detay: [[entegrasyon-ve-pazaryeri-kararlari]].

## Baglantili notlar
[[siparis-kanallari]] · [[saas-platform-katmani]]
