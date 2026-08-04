import { getTranslations } from "next-intl/server";

import { getCurrentTenant, getTenantTimezone } from "@/lib/data/tenant";
import { isEnabled } from "@/lib/modules/isEnabled";

import { createPublicReservation } from "./actions";
import { ReservationRequestForm } from "./reservation-request-form";

export default async function ReservationRequestPage() {
  const t = await getTranslations("menu.reservation");
  const tenant = await getCurrentTenant();

  if (!tenant || !(await isEnabled(tenant.id, "reservations"))) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("notAvailable")}</p>
      </main>
    );
  }

  const timezone = await getTenantTimezone(tenant.id);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 p-4 sm:p-8">
      <h1 className="text-xl font-semibold">{t("pageTitle")}</h1>
      <ReservationRequestForm tenantId={tenant.id} timezone={timezone} createPublicReservation={createPublicReservation} />
    </main>
  );
}
