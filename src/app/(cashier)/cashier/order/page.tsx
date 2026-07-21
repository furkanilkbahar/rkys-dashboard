import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { requireCashierActor } from "@/lib/auth/cashierGuard";
import { getDefaultBranchId } from "@/lib/data/branch";
import { getCashierTables } from "@/lib/data/cashier";
import { getEffectiveMenu } from "@/lib/data/menu";
import { getCurrentTenant } from "@/lib/data/tenant";

import { submitStaffOrder } from "./actions";
import { PosOrder } from "./pos-order";

export default async function CashierOrderPage() {
  const actor = await requireCashierActor();
  const branchId = await getDefaultBranchId(actor.tenantId);
  if (!branchId) {
    notFound();
  }

  const locale = await getLocale();
  const [tenant, tables, categories] = await Promise.all([
    getCurrentTenant(),
    getCashierTables(actor.tenantId, branchId),
    getEffectiveMenu(actor.tenantId, branchId, locale),
  ]);

  return (
    <PosOrder
      currency={tenant?.currency ?? "TRY"}
      tables={tables}
      categories={categories}
      submitStaffOrder={submitStaffOrder}
    />
  );
}
