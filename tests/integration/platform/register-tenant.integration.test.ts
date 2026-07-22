import { afterAll, describe, expect, it } from "vitest";

import { registerTenant } from "../../../src/app/(marketing)/kayit/actions";
import { serviceRoleClient } from "../../helpers/testClients";

// registerTenant, getCurrentActor/cookies() gibi Next.js istek bağlamına
// bağımlı olmadığından (yalnızca service-role client + process.env) burada
// doğrudan çağrılabiliyor — diğer server action'ların aksine (bkz. diğer
// entegrasyon testlerinin RPC/RLS katmanını test etme kuralı).
const createdTenantIds = new Set<string>();
const createdUserIds = new Set<string>();

afterAll(async () => {
  const service = serviceRoleClient();
  for (const id of createdTenantIds) {
    await service.from("tenants").delete().eq("id", id);
  }
  for (const id of createdUserIds) {
    await service.auth.admin.deleteUser(id);
  }
});

describe("registerTenant (Faz 4 Adım 6, S20)", () => {
  it("yeni tenant + owner + otomatik trial abonelik oluşturur", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const slug = `test-register-${suffix}`;
    const email = `owner-register-${suffix}@test-throwaway.test`;

    const result = await registerTenant({
      businessName: "Test İşletmesi",
      slug,
      email,
      password: "password123",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.redirectUrl).toContain("http");

    const service = serviceRoleClient();
    const { data: tenant } = await service.from("tenants").select("id, name, status, onboarding_completed_at").eq("slug", slug).single();
    expect(tenant).not.toBeNull();
    expect(tenant?.name).toBe("Test İşletmesi");
    expect(tenant?.status).toBe("active");
    expect(tenant?.onboarding_completed_at).toBeNull();
    createdTenantIds.add(tenant!.id);

    const { data: branch } = await service.from("branches").select("id, is_default").eq("tenant_id", tenant!.id).single();
    expect(branch?.is_default).toBe(true);

    const { data: domain } = await service
      .from("tenant_domains")
      .select("domain, is_primary")
      .eq("tenant_id", tenant!.id)
      .single();
    expect(domain?.domain).toBe(`${slug}.localhost:3000`);
    expect(domain?.is_primary).toBe(true);

    const { data: profile } = await service.from("profiles").select("id, role, is_active").eq("tenant_id", tenant!.id).single();
    expect(profile?.role).toBe("owner");
    expect(profile?.is_active).toBe(true);
    createdUserIds.add(profile!.id);

    const { data: subscription } = await service.from("subscriptions").select("status, trial_ends_at").eq("tenant_id", tenant!.id).single();
    expect(subscription?.status).toBe("trialing");
    expect(subscription?.trial_ends_at).not.toBeNull();
  });

  it("aynı alt alan adı ikinci kez kullanılamaz", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const slug = `test-register-dup-${suffix}`;

    const first = await registerTenant({
      businessName: "İlk İşletme",
      slug,
      email: `owner-dup1-${suffix}@test-throwaway.test`,
      password: "password123",
    });
    expect(first.ok).toBe(true);
    if (first.ok) {
      const service = serviceRoleClient();
      const { data: tenant } = await service.from("tenants").select("id").eq("slug", slug).single();
      if (tenant) createdTenantIds.add(tenant.id);
    }

    const second = await registerTenant({
      businessName: "İkinci İşletme",
      slug,
      email: `owner-dup2-${suffix}@test-throwaway.test`,
      password: "password123",
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toBe("slug_taken");
    }
  });

  it("geçersiz slug (büyük harf/özel karakter) reddedilir", async () => {
    const result = await registerTenant({
      businessName: "Geçersiz",
      slug: "Invalid Slug!",
      email: `owner-invalid-${crypto.randomUUID().slice(0, 8)}@test-throwaway.test`,
      password: "password123",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("invalid_input");
    }
  });

  it("rezerve edilmiş bir slug (ör. 'admin') reddedilir", async () => {
    const result = await registerTenant({
      businessName: "Rezerve",
      slug: "admin",
      email: `owner-reserved-${crypto.randomUUID().slice(0, 8)}@test-throwaway.test`,
      password: "password123",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("invalid_input");
    }
  });
});
