---
tags: [runbook, ortam, deploy, ci]
ozet: "Lokal-oncelikli akis: Lokal -> GitHub CI -> Staging -> Production; production'a erken cikis yasak."
guncelleme: 2026-08-04
---

# Ortamlar & Deploy

## Akis
```
Lokal (bu makine) -> GitHub (CI) -> Staging -> Production
```

## Lokal (aktif — tek fiilen calisan ortam)
Next.js dev server (`pnpm dev`, Turbopack) + Docker'da lokal Supabase (`supabase start`): Postgres, Auth, Realtime, Storage, Studio, Kong. Tenant cozumleme `*.localhost:3000` ile (ek `/etc/hosts` gerekmez). Seed (`supabase/seed/seed.sql`) her `supabase db reset`'te yenilenir; demo tenant'lar `acme`/`beta`.

> **`supabase db reset` Storage'i da siler.** Gorseller SQL ile geri gelmez —
> reset sonrasi ayrica `node scripts/seed-images.mjs` calistirilir. Bu komut
> hem 21 demo urun fotografini hem de 48 onboarding sablon gorselini
> (`_templates/`) yukler. Calistirilmazsa menu fotografsiz acilir (kirilmaz)
> ve "Demo veriyle kesfet" yolu kirik gorsellerle gelir.

## GitHub + CI (aktif)
`.github/workflows/ci.yml`: 3 sirali job — `lint-typecheck-unit` -> `integration-and-rls` (lokal Supabase CLI) -> `e2e` (Playwright, chromium+mobile-safari). Kirmizi testle merge yok.

## Staging (TANIM — henuz kurulmadi)
Ayri Supabase Cloud projesi + Vercel preview/staging. Migration'lar once staging'e, sonra CI onayli pipeline ile prod'a. Test tenant'lari burada yasar. **Acilisi kullanici onayina tabidir** (RULES #45).

## Production (KURULU — D83, 2026-07-28)
Vercel projesi `rkys` (`rkys.vercel.app`), GitHub `main`'e otomatik deploy + PR preview. Supabase Cloud projesi `rkys` (ref `ifwzdjiwvpkbzeofaxyj`, region ap-southeast-2).

**Migration durumu (2026-08-04):** 0001-0090 uygulandi. 0090 (tema katalogu v2,
D88) bu tarihte `supabase db push --linked` ile itildi; oncesinde prod'da yeni
tema KODU vardi ama tema VERISI yoktu — kirilma olmadi cunku emekli tema
CSS'leri strangler kurali (RULES #22) geregi silinmemisti.

**Deploy durumu nasil dogrulanir:** `vercel ls` (deploy listesi + durum).
`vercel ls --prod` KULLANMA — o komut alias listesi donduruyor ve "son deploy
19 saat once" gibi yaniltici bir tablo cikariyor; 2026-08-04'te bu yuzden bir
kez yanlis rapor verildi. Canli surumun hangi commit oldugunu gormek icin
`vercel inspect <url>` ciktisindaki `created` zamanini commit zamaniyla
karsilastir.

**Onboarding demo gorselleri prod'da yuklu** (`_templates/`, 48/48 dogrulandi,
2026-08-04). "Demo veriyle kesfet" yolunu secen her yeni isletme fotografli
menu alir.

**`seed.sql` PROD'A ASLA ITILMEZ** — icinde `owner@acme.test` / `password123`
gibi bilinen zayif sifreli demo hesaplar var. Demo deneyimi onboarding
sablonlariyla saglanir, seed tenant'lariyla degil. **Bu, gercek/odeyen kullanicilara acildigi anlamina GELMEZ** — yalniz altyapi baglantisi (wiring) kuruldu; lansman icin ayrica onay gerekir (RULES #45 istisnasi D83).

## Kural: Production'a erken cikis YASAK
Proje lokalde uctan uca tamamlanip kullanici onayi alinmadan gercek lansman yapilmaz (D72, RULES #45). D83 bu kurali BILEREK kismen delip altyapi baglantisini erken actirdi — istisna sadece wiring icin, lansman onayi hala ayri.

## Ilgili kararlar
D67 (lokal-oncelikli akis), D72 (erken cikis yasagi), D83 (altyapi erken baglandi). Detay: [[deploy-ve-ortam-kararlari]].

## Baglantili notlar
[[izleme-ve-guvenlik-durusu]] · [[tema-i18n-dayaniklilik]]
