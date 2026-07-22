import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getActiveAnnouncement } from "@/lib/data/announcements";
import { getAdminModules } from "@/lib/data/adminSettings";
import { getCurrentTenant } from "@/lib/data/tenant";
import { isOnboardingCompleted } from "@/lib/data/onboarding";
import { isSubscriptionActive } from "@/lib/data/subscription";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireAdminActor();

  if (!(await isOnboardingCompleted(actor.tenantId))) {
    redirect("/admin/onboarding");
  }

  // Faz 4 Adım 3 (S13): trial süresi dolmuş/abonelik pasif tenant'ta yalnızca
  // personel paneli kısıtlanır — tam kilit değil (Süper Admin tenant'ı
  // askıya almadıkça misafir menüsü çalışmaya devam eder, bkz. is_tenant_active
  // ile karışmasın diye ayrı bir RPC/kontrol, Adım 1).
  if (!(await isSubscriptionActive(actor.tenantId))) {
    redirect("/admin/billing");
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
