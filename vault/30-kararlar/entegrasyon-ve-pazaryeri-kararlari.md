---
tags: [karar, entegrasyon, pazaryeri, muhasebe, fiskal]
ozet: "Pazar yeri karma stratejisi (D51/D70) ve muhasebe/ÖKC mock-first yaklasiminin (D61/D84) kararlari."
guncelleme: 2026-08-01
---

# Entegrasyon & Pazar Yeri Kararlari

## D51 -> D70 — Pazar yeri: karma strateji (Oturum 3 acti, Oturum 4 kapatti)
Baslangicta acik karar: dogrudan platform API'leri mi, araci katman mi? D70 ile kapandi: **karma strateji** — araci katmanla (Posentegra/Entegre App sinifi) hizli cikis + Yemeksepeti resmi Plugin / Trendyol partner baglantilarina kademeli gecis. Adaptor deseni gecisi seffaf kilar.

## D61 -> D84 — Muhasebe + ÖKC: mock-first (Oturum 3, Oturum 8)
D61: muhasebe fazli (CSV/Excel erken, API adaptoru Faz 10), ÖKC adaptor kapisi SADECE arayuz olarak dokumante edilecekti (implementasyon yok — gercek GIB sertifikasyonu bu kapsamda alinamiyor). D84 (2026-07-28) bunu mock-first'e genisletti: `PaymentProvider` ile ayni desende `mockFiscalProvider` eklendi, `record_payment` akisina gercekten baglandi (best-effort, odemeyi bloklamiyor). Kullanici onayi: "mock-first deseni genislet."

## D66 — SMS adaptoru: somut secim ertelendi (Oturum 4, REVIZE)
Adaptor mimarisi (`lib/integrations/sms`) kesin, ama somut saglayici secimi artik ZORUNLU degil — kullanici gundeme getirdiginde yapilacak (oncelik degil).

## Baglantili notlar
[[entegrasyon-adaptorleri]] · [[siparis-kanallari]]
