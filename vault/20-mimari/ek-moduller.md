---
tags: [mimari, rezervasyon, kiosk, vardiya]
ozet: "Faz 11 ek moduller: rezervasyon+bekleme listesi, kiosk modu, vardiya planlama+puantaj."
guncelleme: 2026-08-01
---

# Ek Moduller: Rezervasyon, Kiosk, Vardiya Planlama

## Ne ise yarar
100k$ kapsam genisletmesiyle (D63) eklenen, hepsi bagimsiz acilir-kapanir modul.

## Nasil calisir
- **Rezervasyon + bekleme listesi:** misafir oturumsuz talep gonderir (`pending`) -> admin masa atayip onaylar (`confirmed`) -> oturtur (`seated`). Walk-in bekleme listesine eklenir, cagrilir (`called`), oturtulur. Masa haritasi entegre.
- **Kiosk modu:** admin kiosk cihazi ekler, pairing code uretilir; tablet `/kiosk/[pairingCode]/baslat` ile paket sayfasina baglanir (kod yeniden kullanilabilir), oturuma `kiosk_device_id` islenir. "Siradaki Musteri" mevcut oturumu kapatip yenisini acar. Gecersiz/pasif kod reddedilir.
- **Vardiya planlama + puantaj:** admin yetkili cihaz olusturur (ham secret bir kerelik gosterilir), personele PIN atar; cihaz `/vardiya/kurulum`'da secret'i dogrulayip eslenir. Personel PIN pad ile giris/cikis yapar (ilk cagri 'in', ikinci 'out'). Haftalik cizelge + calisma saati raporu + CSV export. Ayni PIN altyapisi mevcut vardiya sistemine (bkz. [[kimlik-rol-izin]]) dayanir, `staff_scheduling` modulunden bagimsiz calisir.

## Veri modeli
`reservations` + `waitlist`, `kiosk_devices`, `staff_shifts`, `timeclock_entries`.

## Ilgili kod
`src/app/(menu)/rezervasyon`, `src/app/(menu)/kiosk`, `src/app/vardiya/kurulum`, `src/lib/reservations`, `src/lib/kiosk`, `src/lib/scheduling`.

## Ilgili kararlar
D63 (plana alindi — 100k$ kapsam), D82 (rakip analizi genisletmesi).

## Baglantili notlar
[[qr-menu-siparis]] · [[kimlik-rol-izin]]
