---
tags: [runbook, yedekleme, felaket-kurtarma, performans, surum]
ozet: "Gunluk yedek+PITR, aylik restore tatbikati, veri/performans hijyeni, surum yonetimi."
guncelleme: 2026-08-01
---

# Yedekleme, Veri Hijyeni & Surum Yonetimi

## Yedekleme ve Felaket Kurtarma
- Gunluk otomatik DB yedegi + **PITR** aktif.
- Storage (gorseller) yedegi; farkli konumda saklanir.
- **Ayda bir geri donus tatbikati:** staging'e restore edilip dogrulanir (yedek, restore edilene kadar yedek degildir).
- RPO <= 24 saat (hedef PITR ile dakikalar), RTO hedefi <= 4 saat (v1).

## Veri ve Performans Hijyeni
- Rapor sorgulari ozet tablolar/materialized view (`daily_sales_summary`) uzerinden; ham tablolar sinirsiz saklanir.
- Gorseller CDN + WebP; menu LCP < 2.5 sn butcesi her surumde olculur.
- Zamanlanmis isler (timeout kapama, ozet uretimi, rapor gonderimi, webhook retry) Edge cron'da; basarisizliklari izlenir.

## Surum ve Degisiklik Yonetimi
- Conventional Commits + anlamli surum etiketleri; her yayinda kisa changelog.
- **Modul Sistemi** feature flag olarak kullanilir — yarim ozellik prod'a kapali modul olarak cikabilir (bkz. [[modul-sistemi]]).
- Geri alma plani: her migration icin down/rollback notu.

## Kural: veri asla kaybolmaz
Siparis gecmisi (`orders`, `order_items`, `payments`) hicbir islemde silinmez/yeniden hesaplanmaz — duzeltmeler yeni kayitla yapilir (RULES #18). Gun sonu snapshot'i uretildikten sonra o gunun kayitlari degismez (RULES #36).

## Baglantili notlar
[[ortamlar-ve-deploy]] · [[analitik-merkezi]]
