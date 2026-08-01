---
tags: [mimari, auth, roller, izin, guvenlik]
ozet: "Rol+izin bayragi sistemi ve garsonun owner'dan bagimsiz PIN oturumu (D87)."
guncelleme: 2026-08-01
---

# Kimlik, Roller & Izin Sistemi

## Ne ise yarar
Kim neyi yapabilir sorusunun tek cevabi; garson/mutfak sahada hizli, admin guvenli giris ister.

## Nasil calisir
- **Roller:** guest, garson (waiter), mutfak, kurye, manager, owner, super admin.
- **Giris karmasi:** admin/manager e-posta+sifre (+opsiyonel TOTP); garson/mutfak/kurye yetkili cihazda vardiya modu + PIN.
- **Izin bayraklari:** `role_permissions` (tenant x rol x permission_key -> bool) sabit rollerin ustunde ince ayar saglar (`comp_discount`, `refund`, `reports.revenue`, `menu.edit`, `cash.open_close`, `session.move`...). Tek kontrol noktasi: `lib/auth/can(user, permissionKey)` — atlanamaz (RULES #41).
- **Yeni personel olusturma (D87):** `/admin/staff`'ta rol+rozet+PIN girilir, service-role ile sentetik e-postali gercek `auth.users` hesabi + `profiles` satiri acilir (`createStaffMember`).
- **Garsonun bagimsiz oturumu (D87, mimari revizyon):** owner ve garson AYNI tarayicida farkli cookie adlariyla (`sb-waiter-auth-token`) IKI bagimsiz Supabase Auth oturumu tutar. `/waiter/login` PIN dogrulaninca `verify_staff_pin_identity` RPC + `auth.admin.generateLink`+`verifyOtp` ile o personelin GERCEK oturumu ikinci cookie'de acilir. `lib/supabase/server.ts`'in `createClient()`'i iki cookie'den gecerli olani doner; yalniz `/waiter` altinda (proxy header'iyla) garson cookie'si oncelikli, diger TUM yuzeylerde davranis degismez. RLS/RPC katmanina hic dokunulmadi — owner cikisi garsonu artik dusurmuyor.
- **Vardiya PIN altyapisi (0026/0070):** cihaz+PIN eslesmesi hash'li saklanir (RULES #29), yetkisiz cihazda calismaz.

## Ilgili kod
`src/lib/auth/`, `src/lib/staff/`, `src/lib/supabase/waiterClient.ts`, `src/app/(waiter)/waiter/login`, migration 0089.

## Ilgili kararlar
D4 (3 personel yuzeyi), D26 (giris karmasi), D57 (izin bayraklari), D58 (2FA), D87 (garson bagimsiz oturum + personel olusturma). Detay: [[guvenlik-ve-kimlik-kararlari]].

## Baglantili notlar
[[garson-mutfak-panelleri]] · [[sube-multi-tenancy]]
