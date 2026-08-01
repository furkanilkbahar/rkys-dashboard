"use server";

import { z } from "zod";

import { getCurrentTenant } from "@/lib/data/tenant";
import { getDeviceCredentials } from "@/lib/scheduling/deviceAuth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { createWaiterClient } from "@/lib/supabase/waiterClient";

const pinLoginSchema = z.object({ pin: z.string().regex(/^[0-9]{4,8}$/) });

export type WaiterLoginResult =
  | { ok: true }
  | { ok: false; error: "invalid_input" | "device_not_authorized" | "invalid_pin" | "forbidden" | "unknown" };

const WAITER_PANEL_ROLES = new Set(["owner", "manager", "waiter"]);

/**
 * D87: cihaz+PIN eşleşince o personelin GERÇEK Supabase oturumunu
 * (auth.admin.generateLink + verifyOtp — "parolasız giriş" deseni) waiter
 * cookie ad alanı altında açar. RLS/RPC katmanı bunu normal bir e-posta/
 * şifre girişinden ayırt edemez (custom_access_token_hook her ikisinde de
 * aynı şekilde tetiklenir) — yalnızca HANGİ cookie'de saklandığı farklı.
 */
export async function loginWithPin(input: unknown): Promise<WaiterLoginResult> {
  const parsed = pinLoginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "unknown" };

  const credentials = await getDeviceCredentials();
  if (!credentials) return { ok: false, error: "device_not_authorized" };

  const service = createServiceRoleClient();
  const { data, error } = await service.rpc("verify_staff_pin_identity", {
    p_tenant_id: tenant.id,
    p_device_id: credentials.deviceId,
    p_device_secret: credentials.deviceSecret,
    p_pin: parsed.data.pin,
  });
  if (error || !data || data.length === 0) {
    return { ok: false, error: "invalid_pin" };
  }

  const profile = data[0];
  if (!WAITER_PANEL_ROLES.has(profile.role)) {
    return { ok: false, error: "forbidden" };
  }

  const { data: userData, error: userError } = await service.auth.admin.getUserById(profile.profile_id);
  if (userError || !userData.user?.email) {
    return { ok: false, error: "unknown" };
  }

  const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
  });
  if (linkError || !linkData.properties?.hashed_token) {
    return { ok: false, error: "unknown" };
  }

  const waiterClient = await createWaiterClient();
  const { error: verifyError } = await waiterClient.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyError) {
    return { ok: false, error: "unknown" };
  }

  return { ok: true };
}
