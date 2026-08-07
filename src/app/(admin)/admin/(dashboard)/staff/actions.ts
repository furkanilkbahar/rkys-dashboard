"use server";

import { revalidatePath } from "next/cache";

import { assertCan, PERMISSION_KEYS, type PermissionKey } from "@/lib/auth/can";
import { getCurrentActor, type CurrentActor } from "@/lib/auth/session";
import { STAFF_MANAGEABLE_ROLES, type StaffRole } from "@/lib/data/adminStaff";
import { decryptPin, encryptPin, generatePinCandidate } from "@/lib/staff/pin";
import {
  createStaffMemberFormSchema,
  deviceFormSchema,
  pinResetFormSchema,
  staffUpdateFormSchema,
  type DeviceActionResult,
  type StaffActionResult,
  type StaffPinRevealResult,
} from "@/lib/staff/schemas";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

function mapRpcError(message: string | undefined): Extract<StaffActionResult, { ok: false }>["error"] {
  if (!message) return "unknown";
  if (message.includes("last owner")) return "last_owner";
  if (message.includes("permission denied") || message.includes("only an owner")) return "forbidden";
  if (message.includes("not found")) return "not_found";
  // 0071: aynı tenant'ta iki aktif personelin aynı PIN'i taşıması reddedilir
  // (clock_in_or_out yanlış personele yazabiliyordu). Kullanıcı PIN'i
  // değiştirerek çözebilir — "tekrar deneyin" demek yerine bunu söylüyoruz.
  if (message.includes("PIN_ALREADY_IN_USE")) return "pin_in_use";
  return "unknown";
}

/**
 * D102: PIN başarıyla atandıktan SONRA ham PIN'in şifreli kopyasını saklar
 * (staff_pin_secrets, 0094) — böylece "PIN Göster" fiziksel bir sıfırlama
 * gerektirmez. Hata FIRLATMAZ: şifreleme bir ek özellik, PIN'in kendisi
 * zaten atanmış durumda; anahtar yoksa/yazma başarısızsa akış "gösterilemez
 * ama çalışır" hâline düşer (QR'daki d15a26d dersi).
 */
async function storePinSecret(profileId: string, tenantId: string, rawPin: string): Promise<void> {
  const encrypted = encryptPin(rawPin);
  if (!encrypted) return;

  const service = createServiceRoleClient();
  const { error } = await service
    .from("staff_pin_secrets")
    .upsert(
      { profile_id: profileId, tenant_id: tenantId, pin_encrypted: encrypted, updated_at: new Date().toISOString() },
      { onConflict: "profile_id" },
    );
  if (error) console.error("storePinSecret failed", error);
}

/**
 * PIN'i actor'ın KENDİ oturumuyla atar (reset_staff_pin RPC'si tenant/izin
 * kontrolünü orada yapar) ve başarılıysa şifreli kopyayı yazar. Personel
 * oluşturma, PIN sıfırlama ve PIN üretme akışlarının ortak adımı.
 */
async function assignPin(
  actor: CurrentActor,
  profileId: string,
  rawPin: string,
): Promise<Extract<StaffActionResult, { ok: false }>["error"] | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reset_staff_pin", { p_profile_id: profileId, p_new_pin: rawPin });
  if (error) {
    console.error("assignPin: reset_staff_pin failed", error);
    return mapRpcError(error.message);
  }

  await storePinSecret(profileId, actor.tenantId, rawPin);
  return null;
}

/**
 * D87: yeni personel oluşturur. auth.users satırı sentetik bir e-postayla
 * (hiçbir yüzeyde gösterilmez, personel hiçbir zaman görmez/kullanmaz)
 * service-role ile açılır — kimlik doğrulaması tamamen PIN üzerinden
 * yürür (bkz. verify_staff_pin_identity, 0089). PIN, actor'ın KENDİ
 * oturumuyla mevcut/test edilmiş reset_staff_pin RPC'si üzerinden set
 * edilir (yeni bcrypt bağımlılığı gerekmez).
 */
export async function createStaffMember(input: unknown): Promise<StaffActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };
  try {
    await assertCan(actor, "staff.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const parsed = createStaffMemberFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  if (parsed.data.role === "owner" && actor.role !== "owner") {
    return { ok: false, error: "forbidden" };
  }

  const service = createServiceRoleClient();
  const syntheticEmail = `staff-${crypto.randomUUID()}@internal.rkys.local`;
  const { data: authUser, error: authError } = await service.auth.admin.createUser({
    email: syntheticEmail,
    password: crypto.randomUUID(),
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    // Teknik detay log'a, kullanıcıya anlaşılır mesaj (CLAUDE.md — hata
    // yönetimi). Bu üç adım sessizce "unknown"a düşünce sahadaki bir hata
    // hiçbir izle bırakmıyordu.
    console.error("createStaffMember: auth user creation failed", authError);
    return { ok: false, error: "unknown" };
  }

  const { error: profileError } = await service.from("profiles").insert({
    id: authUser.user.id,
    tenant_id: actor.tenantId,
    role: parsed.data.role,
    full_name: parsed.data.fullName,
    badge_no: parsed.data.badgeNo || null,
    is_active: true,
  });
  if (profileError) {
    console.error("createStaffMember: profile insert failed", profileError);
    await service.auth.admin.deleteUser(authUser.user.id);
    return { ok: false, error: "unknown" };
  }

  const pinError = await assignPin(actor, authUser.user.id, parsed.data.pin);
  if (pinError) {
    // auth.users + profiles satırı geri alınır (PIN'siz personel giriş
    // yapamaz, yarım kayıt bırakmıyoruz); hata KODU korunur — PIN çakışması
    // "bilgileri kontrol edin" değil, "bu PIN kullanımda" demeli.
    await service.auth.admin.deleteUser(authUser.user.id);
    return { ok: false, error: pinError };
  }

  revalidatePath("/admin/staff");
  return { ok: true };
}

export async function updateStaffMember(profileId: string, input: unknown): Promise<StaffActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = staffUpdateFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_staff_member", {
    p_profile_id: profileId,
    p_role: parsed.data.role,
    p_badge_no: parsed.data.badgeNo,
    p_is_active: parsed.data.isActive,
    p_full_name: parsed.data.fullName,
  });
  if (error) return { ok: false, error: mapRpcError(error.message) };

  revalidatePath("/admin/staff");
  return { ok: true };
}

export async function resetStaffPin(profileId: string, input: unknown): Promise<StaffActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = pinResetFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const error = await assignPin(actor, profileId, parsed.data.pin);
  if (error) return { ok: false, error };

  revalidatePath("/admin/staff");
  return { ok: true };
}

/**
 * D102: çakışmayan rastgele bir PIN atar ve ham hâlini bir kez döner
 * (QR'daki "Yenile" karşılığı). Çakışma kararı RPC'nin kendisinde
 * (PIN_ALREADY_IN_USE, 0071) — burada yalnızca aday üretilip yeniden
 * deneniyor. Tenant'ta 10.000 PIN'in tamamı dolu olmadıkça birkaç denemede
 * biter; dolmuşsa pin_in_use dönüp kullanıcıya söylemek, sonsuz denemekten
 * iyidir.
 */
export async function regenerateStaffPin(profileId: string): Promise<StaffPinRevealResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };
  try {
    await assertCan(actor, "staff.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = generatePinCandidate();
    const error = await assignPin(actor, profileId, candidate);
    if (!error) {
      revalidatePath("/admin/staff");
      return { ok: true, pin: candidate };
    }
    if (error !== "pin_in_use") {
      return { ok: false, error: error === "forbidden" || error === "not_found" ? error : "unknown" };
    }
  }

  return { ok: false, error: "pin_in_use" };
}

/**
 * D102: PIN'i sıfırlamadan gösterir. Şifreli kopya yoksa (anahtar
 * ayarlanmadan önce atanmış PIN) not_found döner — arayüz PIN uydurmaz.
 * Okuma service-role ile yapılır: staff_pin_secrets'ın authenticated için
 * hiç policy'si yok (0094), ciphertext sunucudan çıkmaz.
 */
export async function revealStaffPin(profileId: string): Promise<StaffPinRevealResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };
  try {
    await assertCan(actor, "staff.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("staff_pin_secrets")
    .select("pin_encrypted")
    .eq("profile_id", profileId)
    // Tenant filtresi service-role'de RLS olmadığı için ELLE uygulanır —
    // aksi halde bir tenant'ın owner'ı başka tenant'ın PIN'ini isteyebilirdi.
    .eq("tenant_id", actor.tenantId)
    .maybeSingle();
  if (error) {
    console.error("revealStaffPin: lookup failed", error);
    return { ok: false, error: "unknown" };
  }
  if (!data) return { ok: false, error: "not_found" };

  const pin = decryptPin(data.pin_encrypted);
  if (!pin) return { ok: false, error: "not_found" };

  return { ok: true, pin };
}

export async function createStaffDevice(branchId: string, input: unknown): Promise<DeviceActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = deviceFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_staff_device", {
    p_branch_id: branchId,
    p_label: parsed.data.label,
  });
  if (error || !data) return { ok: false, error: "unknown" };

  revalidatePath("/admin/staff");
  return { ok: true, rawSecret: data };
}

export async function revokeStaffDevice(deviceId: string): Promise<StaffActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_staff_device", { p_device_id: deviceId });
  if (error) return { ok: false, error: mapRpcError(error.message) };

  revalidatePath("/admin/staff");
  return { ok: true };
}

export async function updateRolePermission(
  role: StaffRole,
  permissionKey: PermissionKey,
  allowed: boolean,
): Promise<StaffActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };
  try {
    await assertCan(actor, "staff.manage");
  } catch {
    return { ok: false, error: "forbidden" };
  }
  if (!STAFF_MANAGEABLE_ROLES.includes(role) || !PERMISSION_KEYS.includes(permissionKey)) {
    return { ok: false, error: "invalid_input" };
  }
  if (role === "owner") {
    // owner can() içinde her zaman true kabul edilir, satır anlamsız.
    return { ok: false, error: "invalid_input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("role_permissions")
    .upsert(
      { tenant_id: actor.tenantId, role, permission_key: permissionKey, allowed },
      { onConflict: "tenant_id,role,permission_key" },
    );
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/staff");
  return { ok: true };
}
