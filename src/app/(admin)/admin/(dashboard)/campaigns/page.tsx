import { getLocale } from "next-intl/server";

import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminCategories } from "@/lib/data/adminMenu";
import { getAdminCampaigns, getAdminCoupons, getAdminProductOptions } from "@/lib/data/campaigns";
import { assertModuleEnabled } from "@/lib/modules/isEnabled";

import { createCampaign, createCoupon, deleteCampaign, deleteCoupon, toggleCampaign, toggleCoupon } from "./actions";
import { CampaignsManager } from "./campaigns-manager";

export default async function AdminCampaignsPage() {
  const actor = await requireAdminActor();
  await assertModuleEnabled(actor.tenantId, "campaigns");

  const locale = await getLocale();
  const [campaigns, coupons, categories, products] = await Promise.all([
    getAdminCampaigns(actor.tenantId),
    getAdminCoupons(actor.tenantId),
    getAdminCategories(actor.tenantId),
    getAdminProductOptions(actor.tenantId, locale),
  ]);

  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name[locale as "tr" | "en"] ?? c.name.tr }));

  return (
    <CampaignsManager
      campaigns={campaigns}
      coupons={coupons}
      categoryOptions={categoryOptions}
      productOptions={products}
      actions={{ createCampaign, toggleCampaign, deleteCampaign, createCoupon, toggleCoupon, deleteCoupon }}
    />
  );
}
