"use server";

import { getCurrentTenant } from "@/lib/data/tenant";
import { clearDeviceCredentials, getDeviceCredentials, setDeviceCredentials } from "@/lib/scheduling/deviceAuth";
import { clockPinSchema, deviceSetupSchema, type ClockActionResult, type DeviceSetupResult } from "@/lib/scheduling/schemas";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function setupDevice(input: unknown): Promise<DeviceSetupResult> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "invalid_secret" };

  const parsed = deviceSetupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  // Anahtar "<deviceId>.<secret>" biçiminde gösteriliyor (0096). Önek YALNIZCA
  // eşleme anının taşıma biçimi: cihaz id'sini kurulum tarafına ulaştırıp
  // aramayı O(1) yapıyor. Cookie'ye ve sonraki RPC'lere ÇIPLAK secret gider —
  // verify_staff_pin_identity hash'i çıplak secret'tan hesaplıyor, önekli dize
  // oraya sızarsa PIN girişi sessizce başarısız olur.
  const rawKey = parsed.data.deviceSecret.trim();
  const dotAt = rawKey.indexOf(".");
  const bareSecret = dotAt > 0 ? rawKey.slice(dotAt + 1) : rawKey;

  const service = createServiceRoleClient();
  // Önekli dize verilir: 0097 sonrası verify_staff_device iki biçimi de kabul
  // eder ve önekliyi O(1) yoluna sokar.
  const { data: deviceId } = await service.rpc("verify_staff_device", { p_tenant_id: tenant.id, p_secret: rawKey });
  if (!deviceId) return { ok: false, error: "invalid_secret" };

  await setDeviceCredentials({ deviceId, deviceSecret: bareSecret });
  return { ok: true };
}

export async function forgetDevice(): Promise<void> {
  await clearDeviceCredentials();
}

export async function clockInOrOut(input: unknown): Promise<ClockActionResult> {
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "invalid_device" };

  const credentials = await getDeviceCredentials();
  if (!credentials) return { ok: false, error: "invalid_device" };

  const parsed = clockPinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const service = createServiceRoleClient();
  const { data, error } = await service.rpc("clock_in_or_out", {
    p_tenant_id: tenant.id,
    p_device_id: credentials.deviceId,
    p_device_secret: credentials.deviceSecret,
    p_pin: parsed.data.pin,
  });

  if (error) {
    if (error.message.includes("invalid device")) return { ok: false, error: "invalid_device" };
    if (error.message.includes("invalid pin")) return { ok: false, error: "invalid_pin" };
    if (error.message.includes("staff_scheduling module not enabled")) return { ok: false, error: "not_enabled" };
    return { ok: false, error: "invalid_pin" };
  }

  const result = data![0];
  return { ok: true, action: result.action as "in" | "out", badgeNo: result.badge_no };
}
