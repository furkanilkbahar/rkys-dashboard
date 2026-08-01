---
tags: [mimari, analitik, raporlama, dashboard]
ozet: "Ayri Analitik Merkezi: widget dashboard, hedef/anomali uyarilari, zamanlanmis raporlar."
guncelleme: 2026-08-01
---

# Analitik Merkezi

## Ne ise yarar
Rapor -> karar destegi + satis argumani; kurumsal beklenti seviyesinde gorunurluk.

## Nasil calisir
- **Widget dashboard:** surukle-birak kartlar (canli ciro, siparis sayaci, saatlik heatmap, en cok satanlar, sube kiyasi), kullanici bazli kalici duzen.
- **Hedefler & anomali:** aylik ciro hedefi + ilerleme; gecelik pg_cron taramasi `daily_sales_summary` kiyasi ile esik asiminda (%30+ dusus) uyari.
- **Zamanlanmis raporlar:** `report_schedules` -> Edge cron -> PDF (@react-pdf/renderer) + e-posta (Resend, mock-first D72 siniri).
- **Rapor seti:** ciro (donem + gecen yil kiyasi), en cok satanlar, saatlik yogunluk, sube/garson performansi, odeme/kanal kirilimi, kayip-kacak (sebep kodlu), kar marji -> menu muhendisligi, sadakat/kampanya performansi, degerlendirmeler.
- **Erisim:** rol/izin bayrakli (`reports.revenue`, `reports.profit`, `reports.loss`...); **veri gecmisi sinirsiz**, ham tablolar hep saklanir — ozet tablolar/materialized view uzerinden sorgulanir (performans hijyeni, bkz. [[yedekleme-ve-surum-yonetimi]]).

## Veri modeli
`report_schedules`, `goals`, `anomaly_alerts`, `daily_sales_summary` (materialized view), `ratings` + `rating_settings`.

## Ilgili kod
`src/app/(analytics)/analytics`, `src/lib/analytics`, `src/lib/reports`.

## Ilgili kararlar
D12 (detayli raporlama), D55 (Analitik Merkezi ayri), D56 (rapor erisimi + sinirsiz gecmis).

## Baglantili notlar
[[kasa-pos-odeme]] · [[stok-recete-maliyet]] · [[crm-sadakat-kampanya]]
