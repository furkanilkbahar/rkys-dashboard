import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { getCurrentActor } from "@/lib/auth/session";

export default async function AdminHomePage() {
  const actor = await getCurrentActor();
  const t = await getTranslations("placeholders");

  if (!actor) {
    redirect("/admin/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">
        {t("adminSignedIn", { tenantId: actor.tenantId, role: actor.role })}
      </p>
    </main>
  );
}
