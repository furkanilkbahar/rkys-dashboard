# Ortamlar — Tanım (D67, D72, D83)

> D72 gereği proje lokalde uçtan uca tamamlanmadan **gerçek** kullanıcıya
> açılan bir canlı ortam olmaz — ama D83 ile Vercel + Supabase Cloud
> bağlantısı (wiring) kullanıcı tarafından bilerek erken açıldı (2026-07-28).
> Aşağıdaki "Production" bölümü artık TANIM değil, kurulu durumu yansıtıyor;
> bu, projenin gerçek kullanıcılara açıldığı/pazarlandığı anlamına gelmez.
> Bkz. OPERATIONS.md §1.

## Akış

```
Lokal (bu makine) → GitHub (CI) → Staging → Production
```

## Lokal (aktif — tek çalışan ortam)

- Next.js dev server (`pnpm dev`, Turbopack) + Docker üzerinde lokal Supabase
  yığını (`supabase start`): Postgres, Auth (GoTrue), Realtime, Storage,
  Studio, Kong.
- Tenant çözümleme `*.localhost:3000` subdomain'leriyle test edilir (RFC 6761,
  ek `/etc/hosts` girdisi gerekmez).
- Seed verisi (`supabase/seed/seed.sql`) her `supabase db reset`'te yeniden
  yüklenir; demo tenant'lar `acme`/`beta`.

## GitHub + CI (aktif)

- Repo: `github.com/furkanilkbahar/rkys-dashboard` (private).
- `.github/workflows/ci.yml`: her push/PR'da 3 sıralı job —
  `lint-typecheck-unit` → `integration-and-rls` (lokal Supabase CLI ile RLS
  testleri) → `e2e` (Playwright, chromium + mobile-safari).
- Kırmızı testle merge yok; branch protection kurulumu (GitHub tarafında)
  proje olgunlaştıkça açılır.

## Staging (TANIM — henüz kurulmadı)

- Ayrı bir Supabase Cloud projesi + Vercel preview/staging deployment.
- Migration'lar önce staging'e uygulanır, prod'a CI onaylı pipeline ile gider.
- Test tenant'ları burada yaşar; gerçek müşteri verisi olmaz.
- **Açılışı kullanıcı onayına tabidir** (RULES #45).

## Production (KURULU — D83, 2026-07-28)

- Vercel projesi: `rkys` (`rkys.vercel.app`), GitHub reposuna bağlı —
  `main`'e her push otomatik Production deploy, her PR otomatik preview
  deploy tetikler.
- Supabase Cloud projesi: `rkys` (ref `ifwzdjiwvpkbzeofaxyj`, region
  ap-southeast-2). Tüm migration'lar (`0001`–`0083`) uygulandı.
- Vercel env (Production + Preview ortak): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `NEXT_PUBLIC_ROOT_DOMAIN=rkys.vercel.app`, `INTERNAL_API_SECRET` (yeni
  üretildi). `LICENSE_SIGNING_PRIVATE_KEY` ayrıca kullanıcı tarafından
  eklenir (mevcut `verify.ts` embedded public key'iyle eşleşmesi gerektiği
  için yeni üretilmedi).
- Günlük otomatik DB yedeği + PITR; aylık restore tatbikatı (OPERATIONS.md §4)
  — henüz kurulmadı, ayrı bir adım.
- Bu, projenin gerçek/ödeyen kullanıcılara **açıldığı** anlamına gelmez —
  yalnızca altyapı bağlantısı kuruldu (D83). Gerçek lansman hâlâ RULES #45
  kapsamında ayrı onaya tabidir.

## Self-Hosted (gelecek — Faz 6)

- Docker image üretimi baştan hazırlanır (bu proje zaten Docker'la çalışıyor);
  tek `docker-compose` hedefi + `lib/licensing` izolasyonu Faz 6'da somutlaşır.
