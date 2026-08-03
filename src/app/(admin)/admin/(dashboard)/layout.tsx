import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getActiveAnnouncement } from "@/lib/data/announcements";
import { getAdminModules } from "@/lib/data/adminSettings";
import { getAdminTenantName } from "@/lib/data/tenant";
import { isOnboardingCompleted } from "@/lib/data/onboarding";
import { isSubscriptionActive } from "@/lib/data/subscription";
import { resolveLicenseGateRedirect } from "@/lib/licensing/verify";
import { MODE_COOKIE, parseMode, type Mode } from "@/themes/mode";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireAdminActor();

  // Yalnızca self-hosted dağıtımlarda ayarlanır (bkz. Dockerfile/docker-compose.yml) —
  // SaaS/cloud tenant'ları bu ortam değişkeni hiç set edilmediği için buradan
  // hiç geçmez. Süper Admin'in DB'deki licenses.license_type='self_hosted'
  // kaydı ile bu env var arasında bağ yok; bu tamamen çevrimdışı bir kapı.
  const licenseRedirect = resolveLicenseGateRedirect(process.env.LICENSE_KEY);
  if (licenseRedirect) {
    redirect(licenseRedirect);
  }

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

  const [tenantName, modules, announcement] = await Promise.all([
    getAdminTenantName(actor.tenantId),
    getAdminModules(actor.tenantId),
    getActiveAnnouncement(),
  ]);
  const enabledModules = modules.filter((m) => m.isEnabled).map((m) => m.moduleKey);

  // D88: koyu/açık tercihi cookie'den — client'ta okunsaydı ilk boyamada flaş olurdu.
  const mode: Mode = parseMode((await cookies()).get(MODE_COOKIE)?.value);

  return (
    <AdminShell
      tenantName={tenantName ?? "—"}
      role={actor.role}
      enabledModules={enabledModules}
      announcement={announcement}
      mode={mode}
    >
      {children}
    </AdminShell>
  );
}
