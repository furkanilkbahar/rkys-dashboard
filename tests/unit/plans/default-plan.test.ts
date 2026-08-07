import { describe, expect, it } from "vitest";

import type { Plan } from "../../../src/lib/data/plans";
import { defaultSelectablePlanId } from "../../../src/lib/utils/defaultPlan";

function plan(key: string, isPublic: boolean, priceMinor = 0): Plan {
  return { id: `id-${key}`, key, name: key, priceMinor, isPublic };
}

describe("defaultSelectablePlanId (D101)", () => {
  it("getPlans'ın gerçek sırasında Demo'yu DEĞİL ilk vitrin planını seçer", () => {
    // getPlans table_limit'e göre sıralar; Demo'nun limiti (5) en küçük
    // olduğu için liste hep onunla başlıyordu ve "Ücretsiz Deneyin"e basan
    // ziyaretçi hiçbir şey seçmeden ₺0'lık iç plana kaydoluyordu.
    const plans = [plan("demo", false), plan("starter", true, 49_900), plan("pro", true, 99_900)];
    expect(defaultSelectablePlanId(plans)).toBe("id-starter");
  });

  it("Demo listede kalır — D96 gereği yalnızca varsayılan olmaktan çıkar", () => {
    const plans = [plan("demo", false), plan("starter", true, 49_900)];
    expect(plans.some((p) => p.key === "demo")).toBe(true);
    expect(defaultSelectablePlanId(plans)).not.toBe("id-demo");
  });

  it("hiç vitrin planı yoksa listenin başına düşer — seçici boş kalmaz", () => {
    const plans = [plan("demo", false), plan("internal", false)];
    expect(defaultSelectablePlanId(plans)).toBe("id-demo");
  });

  it("plan listesi boşsa boş string döner (Select controlled kalır)", () => {
    expect(defaultSelectablePlanId([])).toBe("");
  });
});
