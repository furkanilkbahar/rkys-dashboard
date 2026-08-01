---
tags: [karar, onay-sureci, workflow]
ozet: "D73'ten D79'a onay/otomasyon esiginin 7 adimda evrimi (tarihsel) — guncel hali icin faz-kapanis-ve-onay-akisi'na bak."
guncelleme: 2026-08-01
---

# Onay Sureci Kararlarinin Evrimi (tarihsel)

> Guncel/nihai davranis icin bu notu DEGIL, [[faz-kapanis-ve-onay-akisi]]'ni oku. Burasi "nasil buraya gelindi" sorusuna cevap.

## D73 (Oturum 6, 2026-07-20)
Manuel el testi ritueli kaldirildi, faz kapanisinda otomatik E2E'ye donusturulur. Fazlar arasi gecis onaya tabi KALDI. Faz ici Adim onayi beklenmiyor — "gecici, Faz 4'te tekrar degerlendirilecek" notuyla.

## D74 (ayni oturum)
Faz kapanisinda iki adimli gorunurluk: once senaryo listesi sunulur, sonra kosum onayi istenir; paket yesilse AYRICA faz gecis onayi istenir.

## D75 (Oturum 6, 2026-07-20)
Adim bazli otomatik commit+push: hizli dogrulama yesil olunca onay beklenmeden commit+push (genel "onaysiz commit atma" varsayiminin kalici istisnasi).

## D76 (Oturum 6, 2026-07-21) — REVIZE
D73'un "faz ici Adim onayi beklenmez" gevsemesi Faz 4'ten itibaren KALDIRILDI: her Adim sonrasi bir sonrakine gecmeden once onay istenir.

## D77 (Oturum 6, 2026-07-23) — GECICI istisna
D76 sadece Faz 4'un KALANI icin askiya alindi (kullanici: "Faz 4'u tamamlayana kadar durmani istemiyorum").

## D78 (Oturum 6, 2026-07-23) — KALICI
D76 kalici olarak kaldirildi: hicbir fazda Adim'dan Adim'a onay beklenmez, sinirsiz ve genel talimat (Faz 1-3 modeline kalici donus).

## D79 (Oturum 7, 2026-07-24) — KALICI
D73/D74'un fazlar arasi gecis onayi da kalici olarak kaldirildi: paket yesil olunca dogrudan sonraki faza gecilir. Gerekce: "projeyi hizli bitirmek."

## Baglantili notlar
[[faz-kapanis-ve-onay-akisi]] · [[test-stratejisi]]
