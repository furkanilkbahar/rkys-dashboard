import { listPlatformPlans } from "@/lib/data/platformPlans";

import { PlansManager } from "./plans-manager";

export default async function PlatformPlansPage() {
  const plans = await listPlatformPlans();

  return <PlansManager plans={plans} />;
}
