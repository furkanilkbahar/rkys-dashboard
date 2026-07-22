"use server";

import { revalidatePath } from "next/cache";

import { getCurrentPlatformAdmin } from "@/lib/auth/platformSession";
import { signLicense } from "@/lib/licensing/sign";
import { licenseFormSchema, type CreateLicenseResult } from "@/lib/platform/schemas";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function createLicense(input: unknown): Promise<CreateLicenseResult> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const parsed = licenseFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const issuedAt = new Date().toISOString();
  const expiresAt =
    parsed.data.licenseType === "self_hosted" && parsed.data.expiresAt ? new Date(parsed.data.expiresAt).toISOString() : null;

  const licenseKey = signLicense({
    tenantId: parsed.data.tenantId,
    licenseType: parsed.data.licenseType,
    issuedAt,
    expiresAt,
  });

  const service = createServiceRoleClient();
  const { error } = await service.from("licenses").insert({
    tenant_id: parsed.data.tenantId,
    license_type: parsed.data.licenseType,
    license_key: licenseKey,
    issued_at: issuedAt,
    expires_at: expiresAt,
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/platform/licenses");
  return { ok: true, licenseKey };
}
