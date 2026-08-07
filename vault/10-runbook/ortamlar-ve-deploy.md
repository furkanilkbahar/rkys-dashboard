---
tags: [runbook, ortam, deploy, ci]
ozet: "Lokal-oncelikli akis: Lokal -> GitHub CI -> Staging -> Production; production'a erken cikis yasak."
guncelleme: 2026-08-08
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

## GitHub + CI (TANIMLI AMA KOSMUYOR)
`.github/workflows/ci.yml`: `lint-typecheck-unit` -> `integration-and-rls` (lokal Supabase CLI) + `e2e` (Playwright, chromium+mobile-safari).

> **CI FIILEN CALISMIYOR (2026-08-08'de tespit edildi).** Son 60 kosumun
> 60'i da job HIC BASLAMADAN dustu (`steps=0`). GitHub'in check-run
> annotation'indaki birebir mesaj: *"The job was not started because recent
> account payments have failed or your spending limit needs to be increased.
> Please check the 'Billing & plans' section in your settings"*. Repo PRIVATE
> oldugu icin Actions dakikalari faturaya tabi; odeme/limit duzelene kadar
> **hicbir job kosmuyor**.
>
> **Sonucu:** `tsc`/lint/unit/integration/E2E hicbir seyi KAPIDA TUTMUYOR —
> bu projede "yesil" denen her sey yalnizca LOKAL kosumdan geliyor. D99
> (2026-08-06) ve D101 (2026-08-07) uretim olaylarinin ikisinin de
> arkasindaki asil bosluk bu: korumasi beklenen otomatik kapi zaten yoktu.
> Asagidaki `migrate-production` job'u da faturalandirma duzelene kadar
> ATIL — dogru yazilmis durumda ama kosmuyor.
>
> **Yapilmasi gereken (yalniz hesap sahibi yapabilir):** GitHub Settings ->
> Billing & plans -> odeme yontemi/spending limit duzeltilir. Alternatifler:
> repo'yu public yapmak (Actions ucretsiz) ya da self-hosted runner.

**`migrate-production` job'u (2026-08-08, D99/D101 sonrasi):** `main`'e push'ta,
uc test job'u da yesilse `supabase db push --linked --yes` ile uretim semasini
hizalar. PR'larda ASLA kosmaz (fork PR'i uretim semasina yazamamali).
`environment: production` — GitHub'da bu ortama "required reviewer" eklenirse
migration'lar elle onaya baglanir, job degismeden. `concurrency` grubu
`cancel-in-progress: false` ile: yarida kesilen migration semayi belirsiz
birakir.

**Gereken GitHub secret'lari:** `SUPABASE_ACCESS_TOKEN` (supabase.com/dashboard
/account/tokens), `SUPABASE_PROJECT_REF` (`ifwzdjiwvpkbzeofaxyj`),
`SUPABASE_DB_PASSWORD`. Ucu de yoksa job kirmizi olur, uretim etkilenmez.

**KALAN ACIK:** Vercel `main`'e push'ta kendi deploy'unu BAGIMSIZ baslatiyor,
yani migration ile deploy arasinda sira garantisi yok — yalnizca pencere
daraliyor. Sirayi garantiye almak icin Vercel'in git otomatik deploy'u
kapatilip deploy da bu workflow'dan, `migrate-production`'dan SONRA
tetiklenmeli (VERCEL_TOKEN gerekir). Ayri is, kullanici karari.

## Staging (TANIM — henuz kurulmadi)
Ayri Supabase Cloud projesi + Vercel preview/staging. Migration'lar once staging'e, sonra CI onayli pipeline ile prod'a. Test tenant'lari burada yasar. **Acilisi kullanici onayina tabidir** (RULES #45).

## Production (KURULU — D83, 2026-07-28)
Vercel projesi `rkys` (`rkys.vercel.app`), GitHub `main`'e otomatik deploy + PR preview. Supabase Cloud projesi `rkys` (ref `ifwzdjiwvpkbzeofaxyj`, region ap-southeast-2).

**Migration durumu (2026-08-08):** 0001-0095'in tamami uygulandi
(`supabase migration list --linked` ile dogrulandi). Bu tarihten itibaren
migration'lari CI'daki `migrate-production` job'u itiyor, elle push gerekmiyor.

Onceki kayit (2026-08-04): 0090 (tema katalogu v2, D88) elle `supabase db push
--linked` ile itilmisti; oncesinde prod'da yeni tema KODU vardi ama tema
VERISI yoktu — kirilma olmadi cunku emekli tema CSS'leri strangler kurali
(RULES #22) geregi silinmemisti.

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
