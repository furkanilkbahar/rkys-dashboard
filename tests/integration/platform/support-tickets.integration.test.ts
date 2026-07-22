import { afterAll, describe, expect, it } from "vitest";

import { createPlatformAdmin, createThrowawayTenant, SEED, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const createdUserIds = new Set<string>();
const createdTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of createdUserIds) {
    await service.auth.admin.deleteUser(id);
  }
  for (const id of createdTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

describe("support_tickets/ticket_messages RLS (Faz 4 Adım 5, S15)", () => {
  it("tenant kendi ticket'ını oluşturur, mesaj ekler; başka tenant göremez", async () => {
    const throwaway = await createThrowawayTenant("ticket-own");
    createdTenantIds.add(throwaway.tenantId);
    const owner = await signInAsSeededOwner(throwaway.email);

    const { data: ticket, error: createError } = await owner
      .from("support_tickets")
      .insert({ tenant_id: throwaway.tenantId, subject: "Yardım lazım" })
      .select("id, status")
      .single();
    expect(createError).toBeNull();
    expect(ticket?.status).toBe("open");

    const { error: messageError } = await owner
      .from("ticket_messages")
      .insert({ ticket_id: ticket!.id, tenant_id: throwaway.tenantId, sender: "tenant", body: "Menüde bir sorun var" });
    expect(messageError).toBeNull();

    const acmeOwner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data: crossTenantRead } = await acmeOwner.from("support_tickets").select("id").eq("id", ticket!.id);
    expect(crossTenantRead).toHaveLength(0);
  });

  it("platform_admin tüm tenant'ların ticket'larını görür ve yanıtlayabilir", async () => {
    const admin = await createPlatformAdmin("ticket-platform");
    createdUserIds.add(admin.userId);
    const throwaway = await createThrowawayTenant("ticket-platform");
    createdTenantIds.add(throwaway.tenantId);
    const owner = await signInAsSeededOwner(throwaway.email);

    const { data: ticket } = await owner
      .from("support_tickets")
      .insert({ tenant_id: throwaway.tenantId, subject: "Fatura sorusu" })
      .select("id")
      .single();

    const { data: seenByAdmin, error: adminReadError } = await admin.client.from("support_tickets").select("id").eq("id", ticket!.id);
    expect(adminReadError).toBeNull();
    expect(seenByAdmin).toHaveLength(1);

    const { error: replyError } = await admin.client
      .from("ticket_messages")
      .insert({ ticket_id: ticket!.id, tenant_id: throwaway.tenantId, sender: "platform", body: "Elbette yardımcı olalım" });
    expect(replyError).toBeNull();

    const { error: statusError } = await admin.client.from("support_tickets").update({ status: "answered" }).eq("id", ticket!.id);
    expect(statusError).toBeNull();

    const { data: updated } = await serviceRoleClient().from("support_tickets").select("status").eq("id", ticket!.id).single();
    expect(updated?.status).toBe("answered");
  });

  it("durum akışı open→answered→resolved uçtan uca çalışır", async () => {
    const admin = await createPlatformAdmin("ticket-flow");
    createdUserIds.add(admin.userId);
    const throwaway = await createThrowawayTenant("ticket-flow");
    createdTenantIds.add(throwaway.tenantId);
    const owner = await signInAsSeededOwner(throwaway.email);

    const { data: ticket } = await owner
      .from("support_tickets")
      .insert({ tenant_id: throwaway.tenantId, subject: "Test akışı" })
      .select("id, status")
      .single();
    expect(ticket?.status).toBe("open");

    await admin.client.from("support_tickets").update({ status: "answered" }).eq("id", ticket!.id);
    const { data: afterReply } = await owner.from("support_tickets").select("status").eq("id", ticket!.id).single();
    expect(afterReply?.status).toBe("answered");

    await owner.from("support_tickets").update({ status: "resolved" }).eq("id", ticket!.id);
    const { data: afterResolve } = await owner.from("support_tickets").select("status").eq("id", ticket!.id).single();
    expect(afterResolve?.status).toBe("resolved");
  });

  it("normal personel ticket_messages'a başka tenant adına yazamaz", async () => {
    const throwaway = await createThrowawayTenant("ticket-forbidden");
    createdTenantIds.add(throwaway.tenantId);
    const owner = await signInAsSeededOwner(throwaway.email);

    const { error } = await owner
      .from("ticket_messages")
      .insert({ ticket_id: crypto.randomUUID(), tenant_id: SEED.acme.tenantId, sender: "tenant", body: "sızma denemesi" });
    expect(error).not.toBeNull();
  });
});
