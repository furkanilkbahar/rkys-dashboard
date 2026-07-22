import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getActiveAnnouncement } from "@/lib/data/announcements";
import { getAdminModules } from "@/lib/data/adminSettings";
import { getCurrentTenant } from "@/lib/data/tenant";
import { isOnboardingCompleted } from "@/lib/data/onboarding";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireAdminActor();

  if (!(await isOnboardingCompleted(actor.tenantId))) {
    redirect("/admin/onboarding");
  }

  const [tenant, modules, announcement] = await Promise.all([
    getCurrentTenant(),
    getAdminModules(actor.tenantId),
    getActiveAnnouncement(),
  ]);
  const enabledModules = modules.filter((m) => m.isEnabled).map((m) => m.moduleKey);

  return (
    <AdminShell
      tenantLabel={tenant?.slug ?? actor.tenantId}
      role={actor.role}
      enabledModules={enabledModules}
      announcement={announcement}
    >
      {children}
    </AdminShell>
  );
}
