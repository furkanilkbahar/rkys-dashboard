import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getCurrentTenant } from "@/lib/data/tenant";
import { getDeviceCredentials } from "@/lib/scheduling/deviceAuth";
import { createServiceRoleClient } from "@/lib/supabase/server";

import { loginWithPin } from "./actions";
import { PinLoginPad } from "./pin-login-pad";

export default async function WaiterLoginPage() {
  const t = await getTranslations("waiterLogin");
  const tenant = await getCurrentTenant();
  const credentials = await getDeviceCredentials();

  let isDeviceValid = false;
  if (tenant && credentials) {
    const service = createServiceRoleClient();
    const { data: deviceId } = await service.rpc("verify_staff_device", {
      p_tenant_id: tenant.id,
      p_secret: credentials.deviceSecret,
    });
    isDeviceValid = deviceId === credentials.deviceId;
  }

  if (!tenant || !isDeviceValid) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm font-medium">{t("deviceNotAuthorized")}</p>
        <Link href="/vardiya/kurulum" className="text-sm text-primary underline">
          {t("goToSetup")}
        </Link>
        <Link href="/admin/login" className="text-xs text-muted-foreground underline">
          {t("adminLoginLink")}
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <PinLoginPad loginWithPin={loginWithPin} />
      <Link href="/admin/login" className="text-xs text-muted-foreground underline">
        {t("adminLoginLink")}
      </Link>
    </main>
  );
}
