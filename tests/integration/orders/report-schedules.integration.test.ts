import { afterAll, describe, expect, it } from "vitest";

import { SEED, createThrowawayTenant, serviceRoleClient, signInAsSeededOwner } from "../../helpers/testClients";

const cleanupTenantIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of cleanupTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
});

async function setupTenant(prefix: string) {
  const tenant = await createThrowawayTenant(prefix);
  cleanupTenantIds.add(tenant.tenantId);
  const owner = await signInAsSeededOwner(tenant.email);
  return { ...tenant, owner };
}

describe("report_schedules RLS (Faz 5 Adım 4, S24)", () => {
  it("personel kendi tenant'ının programını oluşturup okuyabilir, sil/aktif-pasif yapabilir", async () => {
    const { tenantId, branchId, owner } = await setupTenant("report-schedule");

    const { data: created, error: createError } = await owner
      .from("report_schedules")
      .insert({ tenant_id: tenantId, branch_id: branchId, frequency: "weekly", recipient_email: "owner@example.com" })
      .select("id, is_active, last_sent_at")
      .single();
    expect(createError).toBeNull();
    expect(created?.is_active).toBe(true);
    expect(created?.last_sent_at).toBeNull();

    const { error: toggleError } = await owner.from("report_schedules").update({ is_active: false }).eq("id", created!.id);
    expect(toggleError).toBeNull();

    const { data: afterToggle } = await owner.from("report_schedules").select("is_active").eq("id", created!.id).single();
    expect(afterToggle?.is_active).toBe(false);

    const { error: deleteError } = await owner.from("report_schedules").delete().eq("id", created!.id);
    expect(deleteError).toBeNull();

    const { data: afterDelete } = await owner.from("report_schedules").select("id").eq("id", created!.id);
    expect(afterDelete).toHaveLength(0);
  });

  it("geçersiz frequency reddedilir (CHECK kısıtı)", async () => {
    const { tenantId, branchId, owner } = await setupTenant("report-schedule-invalid");
    const { error } = await owner
      .from("report_schedules")
      .insert({ tenant_id: tenantId, branch_id: branchId, frequency: "monthly", recipient_email: "owner@example.com" });
    expect(error).not.toBeNull();
  });

  it("RLS: başka tenant'ın personeli programı göremez ve kendi tenant'ı dışına yazamaz", async () => {
    const { tenantId, branchId, owner } = await setupTenant("report-schedule-cross");
    const { data: schedule } = await owner
      .from("report_schedules")
      .insert({ tenant_id: tenantId, branch_id: branchId, frequency: "daily", recipient_email: "owner@example.com" })
      .select("id")
      .single();

    const acmeOwner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data: crossTenantRead } = await acmeOwner.from("report_schedules").select("id").eq("id", schedule!.id);
    expect(crossTenantRead).toHaveLength(0);

    const { error: crossTenantWriteError } = await acmeOwner
      .from("report_schedules")
      .insert({ tenant_id: tenantId, branch_id: SEED.acme.branchId, frequency: "daily", recipient_email: "hack@example.com" });
    expect(crossTenantWriteError).not.toBeNull();
  });
});

describe("sent_emails RLS (Faz 5 Adım 4, S24)", () => {
  it("select-only: staff okuyabilir ama insert edemez; service_role yazabilir", async () => {
    const { tenantId, owner } = await setupTenant("sent-emails");
    const service = serviceRoleClient();

    const { error: staffInsertError } = await owner
      .from("sent_emails")
      .insert({ tenant_id: tenantId, to_email: "x@example.com", subject: "test", provider: "mock" });
    expect(staffInsertError).not.toBeNull();

    const { error: serviceInsertError } = await service
      .from("sent_emails")
      .insert({ tenant_id: tenantId, to_email: "x@example.com", subject: "test", provider: "mock", has_attachment: true });
    expect(serviceInsertError).toBeNull();

    const { data: ownRead } = await owner.from("sent_emails").select("to_email, subject, has_attachment").eq("tenant_id", tenantId);
    expect(ownRead).toHaveLength(1);
    expect(ownRead![0].has_attachment).toBe(true);
  });

  it("RLS: başka tenant'ın gönderilen e-postaları görünmez", async () => {
    const { tenantId } = await setupTenant("sent-emails-cross");
    const service = serviceRoleClient();
    await service.from("sent_emails").insert({ tenant_id: tenantId, to_email: "x@example.com", subject: "test", provider: "mock" });

    const acmeOwner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data: crossTenantRead } = await acmeOwner.from("sent_emails").select("id").eq("tenant_id", tenantId);
    expect(crossTenantRead).toHaveLength(0);
  });
});
