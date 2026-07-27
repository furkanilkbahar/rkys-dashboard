import { getModuleAddonPrices, listPlatformPlans } from "@/lib/data/platformPlans";

import { setModuleAddonPrice } from "./actions";
import { PlansManager } from "./plans-manager";

export default async function PlatformPlansPage() {
  const [plans, addonPrices] = await Promise.all([listPlatformPlans(), getModuleAddonPrices()]);

  return <PlansManager plans={plans} addonPrices={addonPrices} setModuleAddonPrice={setModuleAddonPrice} />;
}
