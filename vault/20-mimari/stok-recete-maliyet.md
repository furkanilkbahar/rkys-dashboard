---
tags: [mimari, stok, recete, maliyet, inventory]
ozet: "Hibrit stok modeli (basit/recete), tedarik ve maliyet/karlilik hesabi."
guncelleme: 2026-08-01
---

# Stok, Recete & Maliyet

## Ne ise yarar
Restoranlarin maliyet/kar gorunurluk ihtiyaci; kafeler icin opsiyonel (`inventory`/`recipes` modulu).

## Nasil calisir
- **Hibrit stok:** urun basina `simple` (adet dusumu) veya `recipe` (malzeme gramaji otomatik duser) modu, `products.track_mode`.
- **Recete dusumu:** `track_mode=recipe` urun satildiginda Edge Fn `recipe_items` uzerinden `stock_movements` (satis dusumu) yazar — YALNIZ server-side, client stok yazamaz (RULES #39). Kritik seviye altinda uyari.
- **Tedarik:** basit alim girisi (miktar + birim maliyet + tedarikci) -> stok artar, hareketli ortalama maliyet guncellenir. Tam PO/mal kabul ileri faz.
- **Maliyet/karlilik:** manuel maliyet + marj raporu erken (Faz 3, recete yoksa `product_costs`); recete acilinca otomatik maliyet + **Menu Muhendisligi Matrisi** (Yildiz/Beygir/Bilmece/Zayif + aksiyon onerileri).
- **Fire/sayim:** fire kaydi stok duser, fiziksel sayim stogu sayilan degere esitler.

## Veri modeli
`ingredients`, `recipes` + `recipe_items`, `stock_movements`, `suppliers`, `purchases`, `product_costs`.

## Ilgili kod
`src/lib/inventory`, ilgili Edge Function (satis dusumu).

## Ilgili kararlar
D45 (hibrit stok), D46 (tedarik fazlari), D47 (karlilik fazlari — manuel erken, otomatik Faz 8).

## Baglantili notlar
[[kasa-pos-odeme]] · [[analitik-merkezi]]
