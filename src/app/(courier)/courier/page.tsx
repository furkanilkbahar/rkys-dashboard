import { redirect } from "next/navigation";

import { CourierPanel } from "@/components/courier/courier-panel";
import { getCurrentActor } from "@/lib/auth/session";
import { assertStaffRole } from "@/lib/auth/staffGuard";
import { getAdminTenantSettings } from "@/lib/data/adminSettings";
import { getCourierAssignments } from "@/lib/data/courier";
import { isSubscriptionActive } from "@/lib/data/subscription";
import { assertModuleEnabled } from "@/lib/modules/isEnabled";

export default async function CourierHomePage() {
  const actor = await getCurrentActor();
  if (!actor) {
    redirect("/admin/login");
  }
  if (!(await isSubscriptionActive(actor.tenantId))) {
    redirect("/admin/billing");
  }
  assertStaffRole(actor, ["owner", "manager", "courier"]);
  await assertModuleEnabled(actor.tenantId, "courier");

  const [assignments, settings] = await Promise.all([
    getCourierAssignments(actor.tenantId, actor.userId),
    getAdminTenantSettings(actor.tenantId),
  ]);

  return <CourierPanel initialAssignments={assignments} currency={settings?.currency ?? "TRY"} />;
}
