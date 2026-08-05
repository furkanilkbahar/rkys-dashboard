import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * D87 + 0071: "Personel Ekle" üç adımdır — auth.users (service-role),
 * profiles satırı, sonra reset_staff_pin. Üçüncü adım tenant içinde AYNI
 * PIN'i taşıyan ikinci bir personeli reddeder (PIN_ALREADY_IN_USE) ve
 * eylem yarım kalan hesabı geri alır. Bu test o dalın hem KODUNU (kullanıcı
 * "PIN kullanımda" mesajını görmeli, "tekrar deneyin" değil) hem de geri
 * almayı sabitler.
 */

const deleteUser = vi.fn(async () => ({ data: null, error: null }));
const createUser = vi.fn(async () => ({ data: { user: { id: "new-staff-id" } }, error: null }));
const insert = vi.fn(async () => ({ error: null }));
const rpc = vi.fn(async () => ({ error: null as { message: string } | null }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({
  getCurrentActor: vi.fn(async () => ({ userId: "owner-id", tenantId: "tenant-id", role: "owner" })),
}));

vi.mock("@/lib/auth/can", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/can")>()),
  assertCan: vi.fn(async () => undefined),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc })),
  createServiceRoleClient: vi.fn(() => ({
    auth: { admin: { createUser, deleteUser } },
    from: vi.fn(() => ({ insert })),
  })),
}));

const { createStaffMember } = await import("@/app/(admin)/admin/(dashboard)/staff/actions");

const INPUT = { fullName: "Hamdi Kalaycı", role: "kitchen", badgeNo: "Y1", pin: "1234" };

describe("createStaffMember()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ error: null });
  });

  it("PIN başka bir personelde kullanılıyorsa pin_in_use döner ve hesabı geri alır", async () => {
    rpc.mockResolvedValue({ error: { message: "PIN_ALREADY_IN_USE" } });

    const result = await createStaffMember(INPUT);

    expect(result).toEqual({ ok: false, error: "pin_in_use" });
    // Yarım kalan auth.users satırı (ve cascade ile profiles) temizlenir.
    expect(deleteUser).toHaveBeenCalledWith("new-staff-id");
  });

  it("üç adım da geçince personel oluşur", async () => {
    const result = await createStaffMember(INPUT);

    expect(result).toEqual({ ok: true });
    expect(deleteUser).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("reset_staff_pin", { p_profile_id: "new-staff-id", p_new_pin: "1234" });
  });

  it("profiles satırı yazılamazsa unknown döner ve auth hesabı kalmaz", async () => {
    insert.mockResolvedValueOnce({ error: { message: "boom" } as unknown as null });

    const result = await createStaffMember(INPUT);

    expect(result).toEqual({ ok: false, error: "unknown" });
    expect(deleteUser).toHaveBeenCalledWith("new-staff-id");
    expect(rpc).not.toHaveBeenCalled();
  });
});
