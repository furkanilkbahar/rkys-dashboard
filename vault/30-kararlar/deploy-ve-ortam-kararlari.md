---
tags: [karar, deploy, ortam, production]
ozet: "Lokal-oncelikli gelistirme ve production'a erken cikis yasaginin karar gecmisi (D67/D72/D83)."
guncelleme: 2026-08-01
---

# Deploy & Ortam Kararlari

## D67 — Lokal-oncelikli akis (Oturum 4, 2026-07-19)
Docker + Supabase CLI ile her sey lokalde gorulur/test edilir -> GitHub+CI -> canliya alma Vercel+Supabase Cloud. Docker image uretimi bastan (self-hosted paketin temeli). Gerekce: kullanici lokalde gormeyi ve kontrollu cikisi istedi.

## D72 — Production'a asla erken cikilmaz (Oturum 5, 2026-07-19)
Proje lokalde uctan uca tamamlanip TUM fazlar bitip kullanici onayi alinmadan hicbir sekilde production'a deploy yapilmaz; staging bile kullanici onayiyla acilir. Gerekce: canliya cikis tamamen kullanici kontrolunde olsun, aceleye getirilmesin.

## D83 — Erken kismi kapanis: altyapi baglantisi bilerek acildi (Oturum 8, 2026-07-28)
Proje henuz lokalde uctan uca tamamlanmamisken (Faz 15 kapandi, Faz 16 basliyor) kullanici D72/RULES#45'i BILEREK devre disi birakip Vercel (`rkys`) + Supabase Cloud (`rkys`, ref `ifwzdjiwvpkbzeofaxyj`) baglattirdi. Surecte 2 gercek migration hatasi bulunup duzeltildi (`gen_random_bytes` search_path, `pg_net` eklenti eksikligi). **Bu, gercek/odeyen kullaniciya acilis (lansman) DEGIL** — yalniz altyapi hazir; staging bu kararin kapsaminda degil, hala kurulmadi. Detay: [[ortamlar-ve-deploy]].

## Baglantili notlar
[[ortamlar-ve-deploy]] · [[urun-anayasasi-ve-kapsam-kararlari]]
