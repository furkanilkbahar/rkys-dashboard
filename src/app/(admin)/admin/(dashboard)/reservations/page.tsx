import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ComingSoon } from "@/components/admin/coming-soon";
import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminModules } from "@/lib/data/adminSettings";

export default async function AdminReservationsPage() {
  const actor = await requireAdminActor();
  const modules = await getAdminModules(actor.tenantId);
  const isEnabled = modules.some((m) => m.moduleKey === "reservations" && m.isEnabled);

  // RULES #34: modül kapalıysa route server tarafında da erişilemez olmalı —
  // yalnızca nav'da gizlemek yetmez.
  if (!isEnabled) {
    notFound();
  }

  const t = await getTranslations("admin.nav");
  return <ComingSoon section={t("reservations")} adim="Faz 8" />;
}
