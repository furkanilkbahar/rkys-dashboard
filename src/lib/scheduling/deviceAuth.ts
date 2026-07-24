import "server-only";

import { cookies } from "next/headers";

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

export async function setDeviceCredentials(credentials: DeviceCredentials): Promise<void> {
  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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
