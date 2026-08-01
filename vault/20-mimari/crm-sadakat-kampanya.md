---
tags: [mimari, crm, sadakat, kampanya, hediye-karti]
ozet: "Opsiyonel musteri kimligi (OTP), moduler sadakat motoru, kural bazli kampanya, hediye karti."
guncelleme: 2026-08-01
---

# CRM, Sadakat & Kampanya

## Ne ise yarar
Musteri sadakati ve tekrar gelis; tamamen opsiyonel — menu anonim akmaya devam eder.

## Nasil calisir
- **Musteri kimligi:** telefon + OTP ile sadakat hesabi, hicbir zaman zorunlu degil; KVKK onaylari `customers` uzerinde kayitli.
- **Sadakat motoru (moduler):** tenant **damga** (urun/kategori kurallı, orn. "9 kahveye 1 bedava") veya **puan** modelini secer; kademe (tier) gelecek fazda motorun ustune.
- **Kampanya/kupon:** Pricing Rules motoru ustunde kural bazli ("2 al 1 ode", saat araligi, kategori kisiti, kullanim limiti) + kupon kodlari; indirim `comps`'a yazilir. Segmentli hedefleme CRM sonrasi, IYS uyumlu iletisimle.
- **Hediye karti:** on odemeli bakiye satisi/harcamasi; **bakiye = borc muhasebesi** ile ayri izlenir, negatife dusurulemez (RULES #37).

## Veri modeli
`customers`, `otp_codes`, `loyalty_programs` (mode: stamp|points), `loyalty_balances`, `loyalty_transactions`, `campaigns`, `coupons` + `coupon_redemptions`, `customer_segments` (sema hazir), `gift_cards` + `gift_card_transactions`.

## Ilgili kod
`src/lib/customer`, `src/lib/loyalty`, `src/lib/campaigns`, `src/lib/giftCards`.

## Ilgili kararlar
D48 (musteri kimligi opsiyonel), D49 (sadakat modulu), D50 (kampanya fazlari), D52 (hediye karti). OTP/SMS altyapisi: [[entegrasyon-adaptorleri]].

## Baglantili notlar
[[analitik-merkezi]] · [[qr-menu-siparis]]
