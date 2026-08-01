---
tags: [karar, urun-anayasasi, kapsam]
ozet: "Urunun temel kimligini belirleyen kararlar: modul sistemi, multi-tenant SaaS, isim, kapsam genislemesi."
guncelleme: 2026-08-01
---

# Urun Anayasasi & Kapsam Kararlari

> DECISIONS.md kok dizinde tek dogru kaynak olarak KALIR — yeni kararlar oraya D-numarasiyla eklenir. Bu not sadece hala etkili olan urun-kimligi kararlarinin sentezidir.

## D38 — Dinamik Olceklenme Ilkesi + Modul Sistemi (Oturum 3)
Cekirdek = QR menu; kasa/stok/CRM/kanallar/rezervasyon/kiosk/vardiya/hediye karti vb. tenant'in actigi/kapattigi modul. Kapali modul hicbir yuzeyde gorunmez. Gerekce: "sadece QR menu isteyene de tam restoran yonetimi isteyene de hizmet" talebi. Detay: [[modul-sistemi]].

## D3 — Bastan multi-tenant SaaS (Oturum 1)
Satilabilir urun hedefi; RLS izolasyonu temel tasarim ilkesi, sonradan eklenmedi.

## D7 — Super Admin + lisans modelleri bastan (Oturum 1)
Abonelik + lifetime + self-hosted (yillik lisans) modelleri bastan planlandi.

## D71 — Urun ismi: RKYS Dashboard (Oturum 4, 2026-07-19)
Alan adi henuz alinmadi; musait degilse isim degisebilir ama subdomain/custom domain mimarisi (D25) bundan etkilenmez.

## D82 — Rakip analizi sonrasi kapsam genislemesi (Oturum 8, 2026-07-27)
5 rakip (adisyo/Menulux/Orion POS/robotPOS/Protel) incelendi -> Faz 13-18 acildi (pazarlama sitesi, gelistirici portali, ucretli ek modul ekonomisi, personel motivasyonu/kurye takip, ÖKC kapisi, bayilik). Bilincli kapsam disi: otel PMS, servis robotu distributorlugu, tenant'lar arasi ortak sadakat agi (RLS izolasyonuna aykiri), kendi pazaryerimiz.

## Baglantili notlar
[[modul-sistemi]] · [[plan-modul-ekonomisi-kararlari]]
