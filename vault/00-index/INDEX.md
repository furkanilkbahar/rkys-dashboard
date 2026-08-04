---
tags: [index]
ozet: "Proje beyni giris noktasi — Bilgi Erisim Protokolu geregi once burasi okunur."
guncelleme: 2026-08-04
---

# Index

> Kok dizindeki yasayan/tek-dogru-kaynak dosyalar (degismedi, buradan linklenir): [[PLAN]] (faz/adim takibi), [[RULES]] (46 kesin kural), [[DECISIONS]] (D1-D93 karar gunlugu). Asagidaki vault notlari bunlarin senteziyoruz + PRD/ARCHITECTURE/OPERATIONS/TESTING'in tasindigi yerdir.

## Mimari (vault/20-mimari)
- [[qr-menu-siparis]] — cekirdek QR menu + siparis durum makinesi
- [[sube-multi-tenancy]] — tenant/sube cozumleme + RLS
- [[modul-sistemi]] — Dinamik Olceklenme Ilkesi, tenant_modules
- [[kimlik-rol-izin]] — roller, izin bayraklari, garson bagimsiz oturumu (D87)
- [[garson-mutfak-panelleri]] — garson paneli + KDS, realtime
- [[kasa-pos-odeme]] — vardiya kasa, POS-lite, odeme/iade/ikram
- [[stok-recete-maliyet]] — hibrit stok, recete dusumu, karlilik
- [[crm-sadakat-kampanya]] — musteri kimligi, sadakat, kampanya, hediye karti
- [[analitik-merkezi]] — widget dashboard, hedef/anomali, zamanlanmis rapor
- [[admin-tablolari-ve-pano]] — DataTable primitifi, duyarlilik modeli, Pano veri kurallari (D91/D92)
- [[siparis-kanallari]] — gel-al/paket/kurye/pazar yeri
- [[saas-platform-katmani]] — Super Admin, plan/abonelik, lisans, destek
- [[ek-moduller]] — rezervasyon, kiosk, vardiya planlama
- [[entegrasyon-adaptorleri]] — muhasebe/ÖKC/SMS adaptorleri, Tenant API/webhooks
- [[tema-i18n-dayaniklilik]] — tema tokenlari, coklu dil, self-hosted

## Runbook (vault/10-runbook)
- [[ortamlar-ve-deploy]] — lokal -> CI -> staging -> production akisi
- [[izleme-ve-guvenlik-durusu]] — Sentry/uptime, status sayfasi, guvenlik
- [[yedekleme-ve-surum-yonetimi]] — yedek/PITR, veri hijyeni, surum
- [[test-stratejisi]] — katmanlar, DoD, RLS sablonu, bilinen aciklar
- [[e2e-senaryolari]] — YASAYAN liste, S1-S55+ (her faz kapanisinda buyur)
- [[faz-kapanis-ve-onay-akisi]] — GUNCEL onay/otomasyon davranisi
- [[kesin-kurallar-indeksi]] — RULES.md'nin kategori bazli hizli haritasi

## Kararlar (vault/30-kararlar)
- [[urun-anayasasi-ve-kapsam-kararlari]] — D38, D3, D7, D71, D82
- [[plan-modul-ekonomisi-kararlari]] — D16-18, D41, D68, D80, D81
- [[deploy-ve-ortam-kararlari]] — D67, D72, D83
- [[onay-sureci-kararlari]] — D73-D79 (tarihsel evrim)
- [[guvenlik-ve-kimlik-kararlari]] — D86, D87
- [[entegrasyon-ve-pazaryeri-kararlari]] — D51/D70, D61/D84, D66

## Oturum (vault/40-oturum)
- [[2026-08-01-obsidian-vault-kurulumu]] — bu vault'un kurulusu + proje beyni aktarimi

## Bakim kurali
Yeni bir "ana bilesen" eklendiginde (yeni modul, yeni panel) ilgili klasore max-80-satirlik bir not + frontmatter (`tags`, `ozet`, `guncelleme`) ile eklenir, buraya linklenir. Mimari degisikliginde ilgili vault notu VE gerekiyorsa DECISIONS.md guncellenir (RULES #20).
