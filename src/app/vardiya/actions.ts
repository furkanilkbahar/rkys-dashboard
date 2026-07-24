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

  const service = createServiceRoleClient();
  const { data: deviceId } = await service.rpc("verify_staff_device", { p_tenant_id: tenant.id, p_secret: parsed.data.deviceSecret });
  if (!deviceId) return { ok: false, error: "invalid_secret" };

  await setDeviceCredentials({ deviceId, deviceSecret: parsed.data.deviceSecret });
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
