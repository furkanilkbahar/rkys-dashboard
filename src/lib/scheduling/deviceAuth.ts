import "server-only";

import { cookies, headers } from "next/headers";

// Vardiya cihazı kimliği Supabase Auth oturumu DEĞİLDİR (RULES #29 gereği
// "yetkili cihaz" personelin kendi kimliğinden bağımsız, cihaza özgü bir
// yetki) — düz httpOnly cookie çifti olarak tutulur, her clock_in_or_out
// çağrısında sunucu tarafında yeniden doğrulanır (cihaz revoke edilirse
// anında etkili olsun diye, bkz. 0070 migration yorumu).
const DEVICE_ID_COOKIE = "rkys_device_id";
const DEVICE_SECRET_COOKIE = "rkys_device_secret";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type DeviceCredentials = { deviceId: string; deviceSecret: string };

export async function getDeviceCredentials(): Promise<DeviceCredentials | null> {
  const cookieStore = await cookies();
  const deviceId = cookieStore.get(DEVICE_ID_COOKIE)?.value;
  const deviceSecret = cookieStore.get(DEVICE_SECRET_COOKIE)?.value;
  if (!deviceId || !deviceSecret) {
    return null;
  }
  return { deviceId, deviceSecret };
}

/**
 * Cookie'nin `Secure` niteliği isteğin GERÇEK protokolünden türetilir.
 *
 * Eski kural `NODE_ENV === "production"` idi; bu bir VEKİL: "üretim ortamı
 * https'tir" varsayımı. Vercel'de doğru ama tek doğru değil — E2E paketi
 * production build'ini (`pnpm start`, yani NODE_ENV=production) DÜZ HTTP
 * üzerinde koşturuyor. Orada cookie `Secure` işaretleniyordu ve WebKit onu
 * saklamayı reddediyordu (Chromium localhost'a ayrıcalık tanır, WebKit
 * tanımaz). Sonuç: cihaz eşleme mobile-safari'de hiç doğrulanamıyordu — S47
 * 45 saniye boyunca "Bu cihaz yetkili değil." ekranında kalıyordu.
 *
 * HEADER YOKSA `Secure` VERİLMEZ, çünkü Next.js TLS'i hiçbir zaman kendisi
 * sonlandırmaz: `x-forwarded-proto` yokluğu, önünde TLS sonlandıran bir vekil
 * olmadığı ve bağlantının düz http olduğu anlamına gelir. Vercel bu header'ı
 * her istekte gönderir, dolayısıyla üretim davranışı birebir korunur.
 */
async function isSecureConnection(): Promise<boolean> {
  const headerStore = await headers();
  // Zincirlenmiş vekillerde değer virgülle ayrılmış olabilir; İSTEMCİYE en
  // yakın olan ilk parçadır.
  const proto = headerStore.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return proto === "https";
}

export async function setDeviceCredentials(credentials: DeviceCredentials): Promise<void> {
  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    secure: await isSecureConnection(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
  cookieStore.set(DEVICE_ID_COOKIE, credentials.deviceId, options);
  cookieStore.set(DEVICE_SECRET_COOKIE, credentials.deviceSecret, options);
}

export async function clearDeviceCredentials(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(DEVICE_ID_COOKIE);
  cookieStore.delete(DEVICE_SECRET_COOKIE);
}
