---
tags: [mimari, auth, roller, izin, guvenlik]
ozet: "Rol+izin bayragi sistemi ve garsonun owner'dan bagimsiz PIN oturumu (D87)."
guncelleme: 2026-08-06
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
- **Vardiya PIN altyapisi (0026/0070):** cihaz+PIN eslesmesi hash'li saklanir (RULES #29), yetkisiz cihazda calismaz. PIN'ler **tenant icinde tekil**: 0071 ayni tenant'ta iki aktif personelin ayni PIN'i tasimasini reddeder (PIN_ALREADY_IN_USE) — cakisma clock_in_or_out'u yanlis personele yazdirabiliyordu. Baska bir tenant ayni PIN'i serbestce kullanir.
- **PIN Goster / Yeni PIN Uret (D102, 0094):** dogrulama hala bcrypt hash ile, ama ham PIN'in AES-256-GCM ile sifreli bir kopyasi `staff_pin_secrets`'ta durur (hash'in yerine degil, ek olarak — D86'daki QR deseninin ayni). Tabloyu hicbir personel okuyamaz (policy yok, grant yalniz service_role); okuma `staff.manage` kontrolunden gecen server action'da, tenant filtresi elle. Anahtar `STAFF_PIN_ENCRYPTION_KEY`; yoksa ozellik kapanir, PIN atama akisi calismaya devam eder.

## Ilgili kod
`src/lib/auth/`, `src/lib/staff/` (`pin.ts` — sifreleme), `src/lib/supabase/waiterClient.ts`, `src/app/(waiter)/waiter/login`, `src/app/(admin)/admin/(dashboard)/staff/actions.ts`, migration 0089 + 0094.

## Ilgili kararlar
D4 (3 personel yuzeyi), D26 (giris karmasi), D57 (izin bayraklari), D58 (2FA), D87 (garson bagimsiz oturum + personel olusturma), D102 (PIN goster/uret). Detay: [[guvenlik-ve-kimlik-kararlari]].

## Baglantili notlar
[[garson-mutfak-panelleri]] · [[sube-multi-tenancy]]
