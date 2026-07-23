import { describe, expect, it } from "vitest";

import { isDue, type ReportScheduleRow } from "@/lib/reports/scheduledDigest";

function makeSchedule(overrides: Partial<ReportScheduleRow>): ReportScheduleRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    tenant_id: "00000000-0000-0000-0000-000000000002",
    branch_id: "00000000-0000-0000-0000-000000000003",
    frequency: "daily",
    recipient_email: "test@example.com",
    is_active: true,
    last_sent_at: null,
    ...overrides,
  };
}

describe("isDue (Faz 5 Adım 4, S24)", () => {
  const now = new Date("2025-06-15T04:00:00Z");

  it("pasif program hiçbir zaman due değildir", () => {
    expect(isDue(makeSchedule({ is_active: false, last_sent_at: null }), now)).toBe(false);
  });

  it("hiç gönderilmemiş program (last_sent_at null) her zaman due'dur", () => {
    expect(isDue(makeSchedule({ last_sent_at: null }), now)).toBe(true);
  });

  it("günlük program: 20 saatten az önce gönderildiyse due değildir, 20+ saat önceyse due'dur", () => {
    const sentRecently = new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString();
    expect(isDue(makeSchedule({ frequency: "daily", last_sent_at: sentRecently }), now)).toBe(false);

    const sentLongAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString();
    expect(isDue(makeSchedule({ frequency: "daily", last_sent_at: sentLongAgo }), now)).toBe(true);
  });

  it("haftalık program: 3 gün önce gönderildiyse due değildir, 7 gün önceyse due'dur", () => {
    const sentThreeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(isDue(makeSchedule({ frequency: "weekly", last_sent_at: sentThreeDaysAgo }), now)).toBe(false);

    const sentSevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(isDue(makeSchedule({ frequency: "weekly", last_sent_at: sentSevenDaysAgo }), now)).toBe(true);
  });
});
