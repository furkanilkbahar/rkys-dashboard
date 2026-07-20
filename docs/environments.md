# Ortamlar — Tanım (D67, D72)

> Bu doküman sadece **tanım/plan** düzeyindedir. Hiçbir deploy adımı içermez —
> D72 gereği proje lokalde uçtan uca tamamlanmadan hiçbir ortam canlıya
> alınmaz. Bkz. OPERATIONS.md §1.

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

## Production (TANIM — henüz kurulmadı)

- Hedef: **Vercel + Supabase Cloud**.
- PR başına preview deployment (Vercel), ayrı Supabase projesi (Prod).
- Günlük otomatik DB yedeği + PITR; aylık restore tatbikatı (OPERATIONS.md §4).
- **Açılışı kullanıcı onayına tabidir ve proje lokalde uçtan uca bitmeden
  gerçekleşmez (D72, RULES #45).**

## Self-Hosted (gelecek — Faz 6)

- Docker image üretimi baştan hazırlanır (bu proje zaten Docker'la çalışıyor);
  tek `docker-compose` hedefi + `lib/licensing` izolasyonu Faz 6'da somutlaşır.
