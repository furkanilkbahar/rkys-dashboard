import { afterAll, describe, expect, it } from "vitest";

import { anonClient, createPlatformAdmin, serviceRoleClient, signInAsSeededOwner, SEED } from "../../helpers/testClients";

const createdUserIds = new Set<string>();
const createdRequestIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of createdRequestIds) {
    await service.from("contact_requests").delete().eq("id", id);
  }
  for (const id of createdUserIds) {
    await service.auth.admin.deleteUser(id);
  }
});

describe("submit_contact_request RPC (Faz 13 Adım 2, S58)", () => {
  it("anon (kimliksiz ziyaretçi) bir talep oluşturabilir", async () => {
    const guest = anonClient();
    const { error } = await guest.rpc("submit_contact_request", {
      p_name: "Test Kişi",
      p_business_name: "Test İşletmesi",
      p_email: "test@example.test",
      p_phone: "05551234567",
      p_message: "Demo talep ediyorum.",
    });
    expect(error).toBeNull();

    const service = serviceRoleClient();
    const { data: request } = await service
      .from("contact_requests")
      .select("id, name, status")
      .eq("email", "test@example.test")
      .single();
    expect(request?.name).toBe("Test Kişi");
    expect(request?.status).toBe("new");
    createdRequestIds.add(request!.id);
  });

  it("anon veya staff, contact_requests tablosuna doğrudan insert yapamaz (RULES #5)", async () => {
    const guest = anonClient();
    const { error, data } = await guest
      .from("contact_requests")
      .insert({ name: "Doğrudan Insert", email: "direct@example.test", message: "deneme" })
      .select();
    expect(error).not.toBeNull();
    expect(data).toBeFalsy();
  });

  it("staff/anon contact_requests'i SELECT edemez (yalnızca platform_admin)", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data, error } = await owner.from("contact_requests").select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});

describe("resolve_contact_request RPC (Faz 13 Adım 2, S58)", () => {
  it("yalnızca platform_admin çağırabilir", async () => {
    const service = serviceRoleClient();
    const { data: request } = await service
      .from("contact_requests")
      .insert({ name: "Yetki Testi", email: "yetki@example.test", message: "deneme" })
      .select()
      .single();
    createdRequestIds.add(request!.id);

    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await owner.rpc("resolve_contact_request", { p_request_id: request!.id, p_status: "contacted" });
    expect(error).not.toBeNull();
  });

  it("platform_admin talebi 'contacted' veya 'closed' olarak işaretleyebilir", async () => {
    const service = serviceRoleClient();
    const { data: request } = await service
      .from("contact_requests")
      .insert({ name: "Çözüm Testi", email: "cozum@example.test", message: "deneme" })
      .select()
      .single();
    createdRequestIds.add(request!.id);

    const admin = await createPlatformAdmin("contact-resolve");
    createdUserIds.add(admin.userId);

    const { error: contactedError } = await admin.client.rpc("resolve_contact_request", {
      p_request_id: request!.id,
      p_status: "contacted",
    });
    expect(contactedError).toBeNull();

    const { data: afterContacted } = await service.from("contact_requests").select("status").eq("id", request!.id).single();
    expect(afterContacted?.status).toBe("contacted");

    const { error: closedError } = await admin.client.rpc("resolve_contact_request", {
      p_request_id: request!.id,
      p_status: "closed",
    });
    expect(closedError).toBeNull();

    const { data: afterClosed } = await service.from("contact_requests").select("status").eq("id", request!.id).single();
    expect(afterClosed?.status).toBe("closed");
  });

  it("geçersiz durum değeri reddedilir", async () => {
    const service = serviceRoleClient();
    const { data: request } = await service
      .from("contact_requests")
      .insert({ name: "Geçersiz Durum", email: "gecersiz@example.test", message: "deneme" })
      .select()
      .single();
    createdRequestIds.add(request!.id);

    const admin = await createPlatformAdmin("contact-invalid-status");
    createdUserIds.add(admin.userId);

    const { error } = await admin.client.rpc("resolve_contact_request", {
      p_request_id: request!.id,
      p_status: "new",
    });
    expect(error).not.toBeNull();
  });
});
