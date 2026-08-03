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
      <main className="ops-surface flex min-h-dvh flex-col items-center justify-center gap-3 bg-[var(--surface-bg)] p-8 text-center text-[var(--surface-fg)]">
        <p className="text-[15px] font-medium">{t("deviceNotAuthorized")}</p>
        <Link href="/vardiya/kurulum" className="text-[14px] text-[var(--surface-accent)] underline">
          {t("goToSetup")}
        </Link>
        <Link href="/admin/login" className="text-[13px] text-[var(--surface-fg-muted)] underline">
          {t("adminLoginLink")}
        </Link>
      </main>
    );
  }

  return (
    // Vardiya başında, ayakta, tablette kullanılan tek ekran — dikey ortalı
    // ve tuşları büyük. `.ops-surface` diğer operasyon panelleriyle aynı
    // dokunma hedefi tabanını verir.
    <main className="ops-surface flex min-h-dvh flex-col items-center justify-center gap-6 bg-[var(--surface-bg)] p-8 text-[var(--surface-fg)]">
      <h1 className="text-[22px] font-bold tracking-[-0.02em]">{t("title")}</h1>
      <PinLoginPad loginWithPin={loginWithPin} />
      <Link href="/admin/login" className="text-[13px] text-[var(--surface-fg-muted)] underline">
        {t("adminLoginLink")}
      </Link>
    </main>
  );
}
