"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PlatformPlan } from "@/lib/data/platformTenants";

const NONE_VALUE = "__none__";

export function PlanSelect({
  tenantId,
  planId,
  plans,
  assignTenantPlan,
}: {
  tenantId: string;
  planId: string | null;
  plans: PlatformPlan[];
  assignTenantPlan: (tenantId: string, planId: string | null) => Promise<{ ok: boolean }>;
}) {
  const t = useTranslations("platform.tenantDetail");
  const [value, setValue] = useState(planId ?? NONE_VALUE);
  const [isPending, setIsPending] = useState(false);

  async function handleChange(next: string | null) {
    const resolved = next ?? NONE_VALUE;
    setValue(resolved);
    setIsPending(true);
    await assignTenantPlan(tenantId, resolved === NONE_VALUE ? null : resolved);
    setIsPending(false);
  }

  return (
    <Select value={value} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder={t("planNone")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>{t("planNone")}</SelectItem>
        {plans.map((plan) => (
          <SelectItem key={plan.id} value={plan.id}>
            {plan.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
