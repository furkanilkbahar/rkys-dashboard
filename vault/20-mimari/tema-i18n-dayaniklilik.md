---
tags: [mimari, tema, i18n, dayaniklilik, self-hosted]
ozet: "CSS-variable tema paketleri, next-intl coklu dil, offline dayaniklilik, self-hosted paket."
guncelleme: 2026-08-01
---

# Tema, i18n, Dayaniklilik & Self-Hosted

## Ne ise yarar
Premium his + uluslararasi satis kapisi + kafe Wi-Fi gercekligine dayanikli deneyim.

## Nasil calisir
- **Tema:** CSS-variable tema paketleri (`src/themes/premium/`), v1 = `warm-luxury` (espresso/antrasit + krem + altin, "asiri koyu olmasin" talebiyle). public/**private** atama — private tema atanmadigi tenant'in listesinde asla gorunmez (RULES #26). Tenant'a ozel hardcode renk YASAK, hep token uzerinden (CLAUDE.md Kod Standartlari).
- **i18n:** next-intl + DB cevirileri (`translations`, `tenant_locales`), tenant kendi dillerini secer; UI'da hardcoded metin yasak (RULES #11).
- **Dayaniklilik:** reconnect + senkron, baglanti gostergesi, sepet korumasi, idempotency — kafe Wi-Fi'sinin kesintili olacagi varsayimiyla tasarlandi (D30).
- **Self-hosted:** Supabase self-host uyumu + tek `docker-compose` hedefi + `lib/licensing` izolasyonu; Faz 6'da somutlasti, yerel `docker build`+`docker-compose up` ile dogrulandi.

## Ilgili kod
`src/themes/`, `src/i18n/`, `docker-compose.yml`, `Dockerfile`, `src/lib/licensing`.

## Ilgili kararlar
D6 (coklu dilli altyapi), D9 (warm-luxury + public/private tema), D13 (tema kimligi), D30 (dayaniklilik).

## Baglantili notlar
[[qr-menu-siparis]] · [[ortamlar-ve-deploy]]
