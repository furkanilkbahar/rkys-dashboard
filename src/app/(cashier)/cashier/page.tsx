import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { getCurrentActor } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/modules/isEnabled";

export default async function CashierHomePage() {
  const actor = await getCurrentActor();

  if (!actor) {
    redirect("/admin/login");
  }

  // RULES #34: kapalı modül route/API/navigasyonda erişilemez olmalı.
  await assertModuleEnabled(actor.tenantId, "pos_cash");

  const t = await getTranslations("placeholders");

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">{t("cashier")}</p>
    </main>
  );
}
