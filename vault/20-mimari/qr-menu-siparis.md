---
tags: [mimari, qr-menu, siparis, cekirdek]
ozet: "Urunun cekirdegi: QR ile acilan misafir menusu ve tek durum makineli siparis motoru."
guncelleme: 2026-08-01
---

# QR Menu & Siparis Cekirdegi

## Ne ise yarar
Urun anayasasinin cekirdegi (bkz. [[urun-anayasasi-ve-kapsam-kararlari]]): her tenant en azindan bu katmana sahiptir, digerleri modul.

## Nasil calisir
- **Iki QR tipi:** masa QR (dogrudan oturum acar) + genel QR (masa sectirir). Baski sablonlari tema uyumlu, coklu format.
- **Menu duzeni:** grid/liste/vitrin, kategori basina admin secimi; `warm-luxury` tema tokenlari (bkz. [[tema-i18n-dayaniklilik]]).
- **Urun yapisi:** varyant + ekstra + stok ("Tukendi" server-side de engellenir, RULES #23).
- **Sepet:** koruma + idempotency_key ile cift siparis engeli (RULES #31).
- **Durum makinesi:** tenant ayarli `direct`/`approval` modu; karma iptal — `pending/approved` serbest, `preparing` sonrasi iptal istegi + garson onayi. Gecisler durum makinesine aykiri yapilamaz (RULES #24).
- **Oturum:** otomatik acilis + odeme/timeout/manuel kapama; masa tasima YALNIZCA garson RPC'si, musteri arayuzunde hic sunulmaz (RULES #27).
- **Garson Cagir:** tipsiz tek dokunus + tenant ozel tipler; kritik olaylarda israrci tekrar sesi.
- **Kanal tek motoru:** tum siparisler `orders.channel` (`dine_in|pickup|delivery|marketplace`) ile ayni durum makinesinden ve ayni KDS'ten akar — bkz. [[siparis-kanallari]].

## Veri modeli
`tables`, `generic_qr_codes`, `table_sessions` (+`session_events`), `menu_categories` (layout, station), `products` (track_mode), `product_variants`, `product_extras`, `branch_product_overrides`, `orders`, `order_items` (+fiyat kopyasi), `order_item_extras`.

## Ilgili kod
`src/app/(menu)/masa`, `src/app/(menu)/paket`, `src/app/(menu)/teslimat`, `src/lib/orders`, `src/lib/menu`, `src/lib/tables`, `src/lib/qr`.

## Ilgili kararlar
D1 (mobil ertelendi, web+ses), D22 (karma iptal), D23 (oturum + masa tasima yetkisi), D24 (musteri gorunumu), D28 (israrci ses), D29 (iki QR tipi), D30 (dayaniklilik). Guvenlik detayi icin `RULES.md` §Guvenlik ve §Urun Davranisi.

## Baglantili notlar
[[garson-mutfak-panelleri]] · [[sube-multi-tenancy]] · [[siparis-kanallari]]
