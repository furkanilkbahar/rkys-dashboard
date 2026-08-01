---
tags: [karar, plan, modul, fiyatlandirma, saas]
ozet: "Plan/fiyatlandirma taslagi ve plan-modul-kaynak modelinin (D80/D81) kararlari."
guncelleme: 2026-08-01
---

# Plan & Modul Ekonomisi Kararlari

## D16-D18 — 3 plan, masa bazli limit, kartsiz trial (Oturum 2)
3 plan (Baslangic/Pro/Sinirsiz); limit YALNIZ masa sayisi, tum ozellikler her planda potansiyel acik; 14 gun tam ozellikli trial, kart istenmez (sifir giris bariyeri).

## D41 / D68 — Sube dahil + fiyat taslagi (Oturum 3-4)
Plana dahil sube sayisi + ek sube aylik ucret. Taslak: Baslangic 10 masa/1 sube · Pro 25/2 · Sinirsiz sonsuz/3 dahil; kesin fiyatlar lansmanda (D82 ile Faz 13'te ana sayfaya gercek fiyat kondu, bu not kapandi).

## D80 — Kapali-kapi kayit onayi (Oturum 8, Faz 4 revizyonu)
`/kayit` formu tenant'i dogrudan `active` acmiyor: `pending_approval` + `plan_id` ile aciliyor, odeme kok domainde aliniyor, `proxy.ts` alt-domaini (admin/login dahil) kapali tutuyor. Onay platform admin elle VEYA `auto_approve_registrations` ayarina bagli. Gerekce: herkes aninda tam erisimli hesap acabiliyordu, plan seciliyor bile degildi (guvenlik/monetizasyon acigi).

## D81 — Uc kaynakli modul modeli + dusurme incelemesi (Oturum 8)
`plan_modules` sablonu + `tenant_modules.source` (`plan`/`paid_addon`/`granted`). Plan dusurmesinde plandan gelen modul hemen silinmez, `pending_removal_since` ile isaretlenir, admin Koru/Kaldir karar verir; `paid_addon` hicbir zaman otomatik dokunulmaz. Detay: [[modul-sistemi]].

## Baglantili notlar
[[urun-anayasasi-ve-kapsam-kararlari]] · [[saas-platform-katmani]]
