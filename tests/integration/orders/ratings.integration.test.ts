import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SEED, bootstrapGuestForTable, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const ACME_COFFEE_PRODUCT_ID = "00000000-0000-4000-8000-000000000201"; // 8000 kuruş

const openedSessionIds = new Set<string>();

beforeAll(async () => {
  const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
  await owner.from("rating_settings").update({ is_enabled: true, google_review_url: "https://g.page/r/example" }).eq("tenant_id", SEED.acme.tenantId);
});

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of openedSessionIds) {
    await service.from("table_sessions").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", id);
  }
  const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
  await owner.from("rating_settings").update({ is_enabled: false, google_review_url: null }).eq("tenant_id", SEED.acme.tenantId);
});

async function openAndCloseGuestSession(tableId: string) {
  const { client: guest, tableSessionId } = await bootstrapGuestForTable(tableId);
  openedSessionIds.add(tableSessionId);
  await guest.rpc("submit_order", {
    p_idempotency_key: crypto.randomUUID(),
    p_items: [{ productId: ACME_COFFEE_PRODUCT_ID, variantId: null, quantity: 1, extraIds: [] }],
  });

  const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
  await owner.rpc("record_payment", { p_table_session_id: tableSessionId, p_method: "cash", p_amount_minor: 8000, p_tip_amount_minor: 0 });

  return { guest, tableSessionId };
}

async function getAcmeWaiterId() {
  const service = serviceRoleClient();
  const { data } = await service.from("profiles").select("id").eq("tenant_id", SEED.acme.tenantId).eq("role", "waiter").limit(1).single();
  return data!.id as string;
}

describe("RPC: submit_rating (S19)", () => {
  it("misafir kapanmış oturumu için yıldız+yorum+garson puanı bırakabilir", async () => {
    const { guest, tableSessionId } = await openAndCloseGuestSession(SEED.acme.table1Id);
    const waiterId = await getAcmeWaiterId();

    const { data: ratingId, error } = await guest.rpc("submit_rating", {
      p_stars: 5,
      p_comment: "Harika servis",
      p_rated_staff_id: waiterId,
      p_staff_stars: 5,
    });
    expect(error).toBeNull();
    expect(ratingId).toBeTruthy();

    const service = serviceRoleClient();
    const { data: rating } = await service
      .from("ratings")
      .select("table_session_id, stars, comment, rated_staff_id, staff_stars")
      .eq("id", ratingId!)
      .single();
    expect(rating?.table_session_id).toBe(tableSessionId);
    expect(rating?.stars).toBe(5);
    expect(rating?.rated_staff_id).toBe(waiterId);
    expect(rating?.staff_stars).toBe(5);
  });

  it("rating_settings.is_enabled=false olan tenant'ta değerlendirme reddedilir", async () => {
    const { guest, tableSessionId } = await openAndCloseGuestSession(SEED.acme.table2Id);

    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    await owner.from("rating_settings").update({ is_enabled: false }).eq("tenant_id", SEED.acme.tenantId);

    const { error } = await guest.rpc("submit_rating", { p_stars: 4 });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("ratings disabled");

    await owner.from("rating_settings").update({ is_enabled: true }).eq("tenant_id", SEED.acme.tenantId);
    openedSessionIds.add(tableSessionId);
  });

  it("oturum kapanmadan (active) değerlendirme bırakılamaz", async () => {
    const { client: guest, tableSessionId } = await bootstrapGuestForTable(SEED.acme.table1Id);
    openedSessionIds.add(tableSessionId);

    const { error } = await guest.rpc("submit_rating", { p_stars: 4 });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("session not closed");
  });

  it("aynı oturum için ikinci kez değerlendirme bırakılamaz", async () => {
    const { guest } = await openAndCloseGuestSession(SEED.acme.table2Id);

    const { error: firstError } = await guest.rpc("submit_rating", { p_stars: 4 });
    expect(firstError).toBeNull();

    const { error: secondError } = await guest.rpc("submit_rating", { p_stars: 5 });
    expect(secondError).not.toBeNull();
  });

  it("başka tenant'ın personelini garson olarak seçmek reddedilir", async () => {
    const { guest } = await openAndCloseGuestSession(SEED.acme.table1Id);
    const service = serviceRoleClient();
    const { data: betaWaiter } = await service.from("profiles").select("id").eq("tenant_id", SEED.beta.tenantId).limit(1).single();

    const { error } = await guest.rpc("submit_rating", { p_stars: 4, p_rated_staff_id: betaWaiter!.id });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("invalid staff");
  });

  it("RLS: personel yalnızca kendi tenant'ının değerlendirmelerini görür", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await owner.from("ratings").select("tenant_id");
    expect(error).toBeNull();
    expect(data?.every((row) => row.tenant_id === SEED.acme.tenantId)).toBe(true);
  });

  it("RLS: misafir yalnızca kendi oturumunun değerlendirmesini görür", async () => {
    const { guest: guestA, tableSessionId: sessionA } = await openAndCloseGuestSession(SEED.acme.table1Id);
    await guestA.rpc("submit_rating", { p_stars: 3 });

    const { data } = await guestA.from("ratings").select("table_session_id");
    expect(data?.every((row) => row.table_session_id === sessionA)).toBe(true);
  });
});
