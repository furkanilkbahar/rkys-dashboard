import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getCurrentTenant } from "@/lib/data/tenant";
import { getDeviceCredentials } from "@/lib/scheduling/deviceAuth";
import { createServiceRoleClient } from "@/lib/supabase/server";

import { clockInOrOut, forgetDevice } from "./actions";
import { PinPad } from "./pin-pad";

export default async function TimeclockPage() {
  const t = await getTranslations("timeclock");
  const tenant = await getCurrentTenant();
  const credentials = await getDeviceCredentials();

  let isDeviceValid = false;
  if (tenant && credentials) {
    const service = createServiceRoleClient();
    const { data: deviceId } = await service.rpc("verify_staff_device", { p_tenant_id: tenant.id, p_secret: credentials.deviceSecret });
    isDeviceValid = deviceId === credentials.deviceId;
  }

  if (!tenant || !isDeviceValid) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm font-medium">{t("deviceNotAuthorized")}</p>
        <Link href="/vardiya/kurulum" className="text-sm text-primary underline">
          {t("goToSetup")}
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <PinPad clockInOrOut={clockInOrOut} forgetDevice={forgetDevice} />
    </main>
  );
}
