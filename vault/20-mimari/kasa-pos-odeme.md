---
tags: [mimari, kasa, pos, odeme, iade]
ozet: "Vardiya bazli kasa, POS-lite siparis girisi, odeme/iade/ikram akislari."
guncelleme: 2026-08-01
---

# Kasa / POS Modulu & Odeme

## Ne ise yarar
QR kullanmayan musteri gercegi: telefon siparisi, tezgah satisi, nakit tahsilat. `pos_cash` modulu.

## Nasil calisir
- **Vardiya:** `open_shift(opening_balance)` -> satis/odemeler shift'e baglanir -> `close_shift(counted_cash)` -> beklenen-sayilan farki -> gun sonu `day_closures` snapshot -> export. Vardiya kapanmadan yeni vardiya acilamaz; snapshot sonrasi o gunun kayitlari degismez (RULES #36).
- **POS-lite:** kasadan hizli siparis girisi, masaya veya "tezgah" hesabina yazilir.
- **Odeme:** kasada veya online (iyzico), tenant secimli; bahsis hazir tutar cipleri (tenant duzenlenebilir) + ozel tutar; hesap bolme (tek odeme + esit bolusme Faz 3, kalem bazli Faz 6).
- **Ikram/indirim (comp/void):** izin bayragi + ZORUNLU sebep kodu -> kayip-kacak raporuna akar (RULES #35).
- **Iade:** tam iade (online = iyzico gercek API, kasa = manuel), kismi/kalem iade hesap bolmeyle ayni altyapida (Faz 6).
- **Pricing Rules motoru:** servis ucreti, mutlu saat, paket farki — tenant isterse aktive eder.

## Veri modeli
`cash_shifts`, `cash_movements`, `day_closures`, `payments` (method, tip_amount, split_group), `refunds`, `comps`, `reason_codes`, `tip_presets`, `pricing_rules`.

## Ilgili kod
`src/app/(cashier)/cashier`, `src/lib/cashier`, `src/lib/payments` (iyzico adaptoru).

## Ilgili kararlar
D2 (kasa+online odeme), D19 (hesap bolme fazlari), D20 (bahsis cipleri), D21 (Pricing Rules), D42 (kasa modulu + POS-lite), D43 (ikram sebep kodu), D44 (iade fazlari). Detay: [[stok-recete-maliyet]] (kar/marj raporu icin).

## Baglantili notlar
[[siparis-kanallari]] · [[analitik-merkezi]] · [[entegrasyon-adaptorleri]]
