---
tags: [runbook, ortam, deploy, ci]
ozet: "Lokal-oncelikli akis: Lokal -> GitHub CI -> Staging -> Production; production'a erken cikis yasak."
guncelleme: 2026-08-01
---

# Ortamlar & Deploy

## Akis
```
Lokal (bu makine) -> GitHub (CI) -> Staging -> Production
```

## Lokal (aktif — tek fiilen calisan ortam)
Next.js dev server (`pnpm dev`, Turbopack) + Docker'da lokal Supabase (`supabase start`): Postgres, Auth, Realtime, Storage, Studio, Kong. Tenant cozumleme `*.localhost:3000` ile (ek `/etc/hosts` gerekmez). Seed (`supabase/seed/seed.sql`) her `supabase db reset`'te yenilenir; demo tenant'lar `acme`/`beta`.

## GitHub + CI (aktif)
`.github/workflows/ci.yml`: 3 sirali job — `lint-typecheck-unit` -> `integration-and-rls` (lokal Supabase CLI) -> `e2e` (Playwright, chromium+mobile-safari). Kirmizi testle merge yok.

## Staging (TANIM — henuz kurulmadi)
Ayri Supabase Cloud projesi + Vercel preview/staging. Migration'lar once staging'e, sonra CI onayli pipeline ile prod'a. Test tenant'lari burada yasar. **Acilisi kullanici onayina tabidir** (RULES #45).

## Production (KURULU — D83, 2026-07-28)
Vercel projesi `rkys` (`rkys.vercel.app`), GitHub `main`'e otomatik deploy + PR preview. Supabase Cloud projesi `rkys` (ref `ifwzdjiwvpkbzeofaxyj`, region ap-southeast-2), tum migration'lar uygulandi. **Bu, gercek/odeyen kullanicilara acildigi anlamina GELMEZ** — yalniz altyapi baglantisi (wiring) kuruldu; lansman icin ayrica onay gerekir (RULES #45 istisnasi D83).

## Kural: Production'a erken cikis YASAK
Proje lokalde uctan uca tamamlanip kullanici onayi alinmadan gercek lansman yapilmaz (D72, RULES #45). D83 bu kurali BILEREK kismen delip altyapi baglantisini erken actirdi — istisna sadece wiring icin, lansman onayi hala ayri.

## Ilgili kararlar
D67 (lokal-oncelikli akis), D72 (erken cikis yasagi), D83 (altyapi erken baglandi). Detay: [[deploy-ve-ortam-kararlari]].

## Baglantili notlar
[[izleme-ve-guvenlik-durusu]] · [[tema-i18n-dayaniklilik]]
