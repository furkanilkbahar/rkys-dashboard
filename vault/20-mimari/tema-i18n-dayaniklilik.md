---
tags: [mimari, tema, i18n, dayaniklilik, self-hosted]
ozet: "CSS-variable tema paketleri, next-intl coklu dil, offline dayaniklilik, self-hosted paket."
guncelleme: 2026-08-03
---

# Tema, i18n, Dayaniklilik & Self-Hosted

## Ne ise yarar
Premium his + uluslararasi satis kapisi + kafe Wi-Fi gercekligine dayanikli deneyim.

## Nasil calisir
- **Tema (D88, 2026-08-03 — D9/D13'un yerine):** **Uc katmanli token mimarisi.** *Katman 1* tenant temasi YALNIZCA misafir yuzeyini (`(menu)`) boyar — uc public tema: `gece` (koyu + amber), `kagit` (krem/espresso/altin, acik), `kor` (siyah + kirmizi). Emekli: `warm-luxury`, `sage-bistro` — migration 0090 ikisini de `kagit`'a esledi (ikisi de acik temaydi; hicbir isletmenin menusu bir gecede siyaha donmesin), yeni tenant varsayilani `gece`. *Katman 2a* pazarlama (acik zemin, golgeyle yukseklik), *Katman 2b* uygulama chrome'u (cift modlu, duz, notr, dolgu acikligiyla yukseklik) — 2a ve 2b RKYS marka primitiflerini (petrol paleti, Geist + Fraunces, yaricap/hareket olcegi) paylasir, yuzey islemesini paylasmaz.
  Kapsamlama `<html data-surface data-theme data-mode>` uzerinden: `data-surface` `proxy.ts`'te pathname'den header ile enjekte edilir (D87'nin `/waiter` deseni), `data-mode` cookie'den okunur (localStorage degil — ilk boyamada flas olmasin). Sarmalayici `<div>` KULLANILMAZ: `dropdown-menu`/`select`/`sheet` Base UI Portal ile `document.body`'ye render oluyor, token'i kaybederdi. Sizinti uc katmanda yakalanir — lint (tenant tema dosyalari yalnizca `[data-surface="guest"]` secicisi yazabilir), tip (`TenantToken`/`ProductToken` ayri union), E2E (admin'de tema degisimi `--primary`'yi degistirmez).
  Uc tema AYNI bilesen setini kullanir, yalnizca token'lari (renk, tipografi olcegi, yaricap, yogunluk, hareket) degisir — tema basina ayri bilesen YASAK. public/**private** atama korunur; private tema atanmadigi tenant'in listesinde asla gorunmez (RULES #26). Tenant'a ozel hardcode renk YASAK, hep token uzerinden (CLAUDE.md Kod Standartlari). Gorsel sistem + tam token seti: kokte **`DESIGN.md`**.
- **i18n:** next-intl + DB cevirileri (`translations`, `tenant_locales`), tenant kendi dillerini secer; UI'da hardcoded metin yasak (RULES #11).
- **Dayaniklilik:** reconnect + senkron, baglanti gostergesi, sepet korumasi, idempotency — kafe Wi-Fi'sinin kesintili olacagi varsayimiyla tasarlandi (D30).
- **Self-hosted:** Supabase self-host uyumu + tek `docker-compose` hedefi + `lib/licensing` izolasyonu; Faz 6'da somutlasti, yerel `docker build`+`docker-compose up` ile dogrulandi.

## Ilgili kod
`DESIGN.md`, `src/themes/`, `src/proxy.ts`, `src/app/globals.css`, `src/i18n/`, `docker-compose.yml`, `Dockerfile`, `src/lib/licensing`.

## Ilgili kararlar
D6 (coklu dilli altyapi), **D88 (uc katmanli tema mimarisi + Gece/Kagit/Kor — D9/D13'un yerine)**, **D89 (perf butcesi)**, D30 (dayaniklilik). *Tarihsel: D9 (warm-luxury + public/private tema), D13 (tema kimligi) — D88 ile revize edildi.*

## Baglantili notlar
[[qr-menu-siparis]] · [[ortamlar-ve-deploy]]
