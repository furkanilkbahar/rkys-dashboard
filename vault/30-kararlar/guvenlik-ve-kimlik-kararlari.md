---
tags: [karar, guvenlik, kimlik, bug-hunt]
ozet: "Bug-hunt oturumu (2026-08-01) kararlari: QR token sifreleme (D86) ve garson bagimsiz oturum (D87)."
guncelleme: 2026-08-01
---

# Guvenlik & Kimlik Kararlari

## D86 — QR token sifrelenerek AYRICA saklaniyor (Oturum 9, 2026-08-01)
Onceki tasarim yalniz `qr_token_hash` (SHA-256) saklardi; "QR Goster" (fiziksel kodu bozmadan tekrar goruntuleme) imkansizdi. Simdi `qr_token_encrypted` (AES-256-GCM, migration 0088) hash'in YERINE degil YANINDA saklaniyor; anahtar (`QR_TOKEN_ENCRYPTION_KEY`) yoksa kolon null kalir, mevcut akislar kirilmiyor (geriye donuk uyumlu). Onemli netlik: RULES.md #7 yalniz token'larin TAHMIN EDILEMEZ uretilmesini sart kosuyordu, ham deger saklanmamasi hicbir zaman yazili kesin kural degildi — bu sadece bir uygulama tercihiydi.

## D87 — Garson owner'dan bagimsiz PIN girisi (Oturum 9, 2026-08-01)
Kok neden: garson ve owner AYNI tarayicida AYNI Supabase Auth cookie'sini paylasiyordu; ayrica garson icin hesap OLUSTURMA akisi hic yoktu. Cozum: (1) `createStaffMember` ile gercek `auth.users` hesabi acilir, (2) `verify_staff_pin_identity` RPC mevcut vardiya PIN altyapisini yeniden kullanir, (3) `/waiter/login` PIN dogrulaninca ikinci, farkli cookie adinda (`sb-waiter-auth-token`) gercek bir oturum acilir — RLS/RPC katmanina hic dokunulmadan. Detay: [[kimlik-rol-izin]].

## Baglantili notlar
[[kimlik-rol-izin]] · [[qr-menu-siparis]]
