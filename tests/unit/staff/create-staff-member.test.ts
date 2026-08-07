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
const upsert = vi.fn(async () => ({ error: null }));
const maybeSingle = vi.fn(async () => ({ data: null as { pin_encrypted: string } | null, error: null }));
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
    from: vi.fn(() => ({
      insert,
      upsert,
      // revealStaffPin zinciri: select(...).eq(...).eq(...).maybeSingle()
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }),
    })),
  })),
}));

const { createStaffMember, revealStaffPin, regenerateStaffPin } = await import(
  "@/app/(admin)/admin/(dashboard)/staff/actions"
);

const INPUT = { fullName: "Hamdi Kalaycı", role: "kitchen", badgeNo: "Y1", pin: "1234" };
const KEY = Buffer.alloc(32, 7).toString("base64");

describe("createStaffMember()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ error: null });
    // Varsayılan: anahtar YOK — testler birbirinin env'ine bağlı kalmasın.
    delete process.env.STAFF_PIN_ENCRYPTION_KEY;
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

  it("anahtar varsa PIN'in şifreli kopyası yazılır, ham PIN veritabanına gitmez", async () => {
    process.env.STAFF_PIN_ENCRYPTION_KEY = KEY;

    await createStaffMember(INPUT);

    expect(upsert).toHaveBeenCalledTimes(1);
    const row = upsert.mock.calls[0][0] as unknown as { profile_id: string; pin_encrypted: string };
    expect(row.profile_id).toBe("new-staff-id");
    expect(row.pin_encrypted).not.toContain("1234");
  });

  it("anahtar yoksa şifreli kopya hiç yazılmaz ama personel yine oluşur", async () => {
    const result = await createStaffMember(INPUT);

    expect(result).toEqual({ ok: true });
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("D102 — PIN göster / üret", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ error: null });
    process.env.STAFF_PIN_ENCRYPTION_KEY = KEY;
  });

  it("şifreli kopya yoksa PIN uydurulmaz, not_found döner", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    expect(await revealStaffPin("staff-1")).toEqual({ ok: false, error: "not_found" });
  });

  it("regenerateStaffPin çakışmada yeniden dener ve sonunda PIN döner", async () => {
    rpc
      .mockResolvedValueOnce({ error: { message: "PIN_ALREADY_IN_USE" } })
      .mockResolvedValueOnce({ error: null });

    const result = await regenerateStaffPin("staff-1");

    expect(result.ok).toBe(true);
    expect(result.ok && result.pin).toMatch(/^[0-9]{4}$/);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("tenant'ta boşta PIN kalmadıysa sonsuza kadar denemez", async () => {
    rpc.mockResolvedValue({ error: { message: "PIN_ALREADY_IN_USE" } });

    expect(await regenerateStaffPin("staff-1")).toEqual({ ok: false, error: "pin_in_use" });
    expect(rpc).toHaveBeenCalledTimes(10);
  });
});
