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

describe("goals: set_monthly_goal / get_goal_progress (Faz 5 Adım 3, S23)", () => {
  it("reports.revenue izni olmayan personel hedef belirleyemez/okuyamaz", async () => {
    const waiter = await signInAsSeededOwner(SEED.acme.waiterEmail);
    const { error: setError } = await waiter.rpc("set_monthly_goal", {
      p_branch_id: SEED.acme.branchId,
      p_period_month: "2025-06-01",
      p_target_revenue_minor: 100000,
    });
    expect(setError).not.toBeNull();
    expect(setError?.message).toContain("forbidden");

    const { error: getError } = await waiter.rpc("get_goal_progress", {
      p_branch_id: SEED.acme.branchId,
      p_period_month: "2025-06-01",
    });
    expect(getError).not.toBeNull();
    expect(getError?.message).toContain("forbidden");
  });

  it("hedef belirlenir, ikinci çağrı günceller (upsert); ilerleme kapatılmış günlerin toplamından hesaplanır", async () => {
    const { tenantId, branchId, owner } = await setupTenant("goal-progress");
    const service = serviceRoleClient();

    const { error: setError } = await owner.rpc("set_monthly_goal", {
      p_branch_id: branchId,
      p_period_month: "2025-06-15",
      p_target_revenue_minor: 500000,
    });
    expect(setError).toBeNull();

    await service.from("daily_sales_summary").insert([
      { tenant_id: tenantId, branch_id: branchId, business_date: "2025-06-05", revenue_minor: 100000, cash_minor: 100000, card_manual_minor: 0, online_minor: 0, tips_minor: 0, comps_minor: 0, refunds_minor: 0, order_count: 2 },
      { tenant_id: tenantId, branch_id: branchId, business_date: "2025-06-10", revenue_minor: 150000, cash_minor: 150000, card_manual_minor: 0, online_minor: 0, tips_minor: 0, comps_minor: 0, refunds_minor: 0, order_count: 3 },
      { tenant_id: tenantId, branch_id: branchId, business_date: "2025-07-01", revenue_minor: 999999, cash_minor: 999999, card_manual_minor: 0, online_minor: 0, tips_minor: 0, comps_minor: 0, refunds_minor: 0, order_count: 1 },
    ]);

    const { data: progress, error: progressError } = await owner.rpc("get_goal_progress", {
      p_branch_id: branchId,
      p_period_month: "2025-06-01",
    });
    expect(progressError).toBeNull();
    expect(progress![0].target_revenue_minor).toBe(500000);
    expect(progress![0].actual_revenue_minor).toBe(250000);

    const { error: updateError } = await owner.rpc("set_monthly_goal", {
      p_branch_id: branchId,
      p_period_month: "2025-06-01",
      p_target_revenue_minor: 750000,
    });
    expect(updateError).toBeNull();
    const { data: updatedProgress } = await owner.rpc("get_goal_progress", { p_branch_id: branchId, p_period_month: "2025-06-01" });
    expect(updatedProgress![0].target_revenue_minor).toBe(750000);
  });

  it("hedef belirlenmemiş ayda target_revenue_minor 0 döner", async () => {
    const { branchId, owner } = await setupTenant("goal-unset");
    const { data } = await owner.rpc("get_goal_progress", { p_branch_id: branchId, p_period_month: "2030-01-01" });
    expect(data![0].target_revenue_minor).toBe(0);
    expect(data![0].actual_revenue_minor).toBe(0);
  });
});

describe("detect_revenue_anomalies (Faz 5 Adım 3, S23)", () => {
  it("yalnızca service_role çağırabilir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { error } = await owner.rpc("detect_revenue_anomalies");
    expect(error).not.toBeNull();
  });

  it("%30+ düşüş anomali uyarısı açar; eşiğin altındaki düşüş açmaz; ikinci koşum tekrar satır yazmaz", async () => {
    const { tenantId, branchId } = await setupTenant("anomaly-trigger");
    const service = serviceRoleClient();

    // Son 4 haftanın aynı günü (Pazartesi'ler, 28 gün geriye kadar) — ortalama 100000.
    const baseline = ["2025-05-05", "2025-05-12", "2025-05-19", "2025-05-26"]; // Pazartesi
    await service.from("daily_sales_summary").insert(
      baseline.map((date) => ({
        tenant_id: tenantId, branch_id: branchId, business_date: date,
        revenue_minor: 100000, cash_minor: 100000, card_manual_minor: 0, online_minor: 0, tips_minor: 0, comps_minor: 0, refunds_minor: 0, order_count: 2,
      })),
    );
    // Test edilen gün: 2025-06-02 (Pazartesi), %40 düşüş (60000 < 100000*0.7).
    await service.from("daily_sales_summary").insert({
      tenant_id: tenantId, branch_id: branchId, business_date: "2025-06-02",
      revenue_minor: 60000, cash_minor: 60000, card_manual_minor: 0, online_minor: 0, tips_minor: 0, comps_minor: 0, refunds_minor: 0, order_count: 1,
    });

    const { error: cronError } = await service.rpc("detect_revenue_anomalies");
    expect(cronError).toBeNull();

    const { data: alerts } = await service
      .from("anomaly_alerts")
      .select("business_date, message")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .eq("business_date", "2025-06-02");
    expect(alerts).toHaveLength(1);
    expect(alerts![0].message).toContain("40%");

    // İkinci koşum: aynı gün için satır zaten var, tekrar eklenmez.
    await service.rpc("detect_revenue_anomalies");
    const { data: alertsAfterSecondRun } = await service
      .from("anomaly_alerts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .eq("business_date", "2025-06-02");
    expect(alertsAfterSecondRun).toHaveLength(1);
  });

  it("%30'un altındaki düşüş anomali açmaz", async () => {
    const { tenantId, branchId } = await setupTenant("anomaly-no-trigger");
    const service = serviceRoleClient();

    const baseline = ["2025-05-06", "2025-05-13", "2025-05-20", "2025-05-27"]; // Salı
    await service.from("daily_sales_summary").insert(
      baseline.map((date) => ({
        tenant_id: tenantId, branch_id: branchId, business_date: date,
        revenue_minor: 100000, cash_minor: 100000, card_manual_minor: 0, online_minor: 0, tips_minor: 0, comps_minor: 0, refunds_minor: 0, order_count: 2,
      })),
    );
    // %20 düşüş (80000 >= 100000*0.7) — eşiği tetiklemez.
    await service.from("daily_sales_summary").insert({
      tenant_id: tenantId, branch_id: branchId, business_date: "2025-06-03",
      revenue_minor: 80000, cash_minor: 80000, card_manual_minor: 0, online_minor: 0, tips_minor: 0, comps_minor: 0, refunds_minor: 0, order_count: 2,
    });

    await service.rpc("detect_revenue_anomalies");
    const { data: alerts } = await service
      .from("anomaly_alerts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .eq("business_date", "2025-06-03");
    expect(alerts).toHaveLength(0);
  });
});

describe("get_active_anomaly_alerts / acknowledge_anomaly_alert (Faz 5 Adım 3, S23)", () => {
  it("aktif uyarılar listelenir, onaylanınca listeden düşer; başka tenant'ın uyarısı görünmez", async () => {
    const { tenantId, branchId, owner } = await setupTenant("anomaly-ack");
    const service = serviceRoleClient();

    const { data: alert } = await service
      .from("anomaly_alerts")
      .insert({ tenant_id: tenantId, branch_id: branchId, business_date: "2025-06-10", message: "test anomali" })
      .select("id")
      .single();

    const { data: activeAlerts, error } = await owner.rpc("get_active_anomaly_alerts", { p_branch_id: branchId });
    expect(error).toBeNull();
    expect(activeAlerts).toHaveLength(1);
    expect(activeAlerts![0].id).toBe(alert!.id);

    const acmeOwner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const { data: crossTenantAlerts } = await acmeOwner.rpc("get_active_anomaly_alerts", { p_branch_id: SEED.acme.branchId });
    expect(crossTenantAlerts?.some((a) => a.id === alert!.id)).toBe(false);

    const { error: ackError } = await owner.rpc("acknowledge_anomaly_alert", { p_alert_id: alert!.id });
    expect(ackError).toBeNull();

    const { data: afterAck } = await owner.rpc("get_active_anomaly_alerts", { p_branch_id: branchId });
    expect(afterAck).toHaveLength(0);
  });
});
