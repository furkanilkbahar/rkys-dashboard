---
tags: [mimari, kanallar, gel-al, kurye, pazar-yeri]
ozet: "Tum siparis kanallari (dine_in/pickup/delivery/marketplace) tek motor uzerinden akar."
guncelleme: 2026-08-01
---

# Siparis Kanallari: Gel-Al, Paket, Kurye, Pazar Yeri

## Ne ise yarar
Farkli satis kanallarini tek siparis/KDS motorunda birlestirmek; her kanal opsiyonel modul.

## Nasil calisir
- **Kanal semasi:** `orders.channel` (`dine_in|pickup|delivery|marketplace`) bastan var — tek durum makinesi, tek KDS.
- **Gel-Al (pickup):** menu linkinden (fiziksel masasiz) siparis -> teslim kodu; mutfak hazir isaretleyince misafir bildirim alir.
- **Paket (delivery):** `delivery_zones` (bolge/ucret/min sepet) + `customer_addresses` + **zamanlanmis siparis** (`scheduled_orders`).
- **Kurye modulu:** `courier` rolu, `courier_assignments` ile atama, Atandi -> Yolda -> Teslim Edildi; canli konum takibi (Leaflet+OSM, Faz 16, S66) gelecek kapisiydi, artik acik.
- **Pazar yeri (marketplace):** adaptor mimarisi (D51 -> D70 karma strateji): aracı katman (Posentegra/Entegre App sinifi) ile hizli cikis, Yemeksepeti resmi Plugin / Trendyol partner baglantilarina kademeli gecis. Ingestion: `POST /api/integrations/marketplace/[provider]/orders` (tenant API anahtariyla) -> SKU eslemesi (`product_external_mappings`) -> `ingest_marketplace_order` -> dogrudan `approved` ile KDS'e. Ayri `marketplace_accounts` tablosu YOK — kimlik `api_keys` uzerinden `authenticateApiRequest` ile cozulur (Faz 10 mimari revizyonu, gereksiz soyutlamadan kacinma ilkesi).

## Veri modeli
`delivery_zones`, `customer_addresses`, `scheduled_orders`, `courier_assignments`, `product_external_mappings`, `api_keys`.

## Ilgili kod
`src/app/(menu)/paket`, `src/app/(menu)/teslimat`, `src/app/(courier)/courier`, `src/app/api/integrations`, `src/lib/delivery`, `src/lib/marketplace`.

## Ilgili kararlar
D53 (order_channel semasi), D54 (kurye modulu), D51/D70 (pazar yeri karma strateji) — detay: [[entegrasyon-ve-pazaryeri-kararlari]].

## Baglantili notlar
[[qr-menu-siparis]] · [[entegrasyon-adaptorleri]]
