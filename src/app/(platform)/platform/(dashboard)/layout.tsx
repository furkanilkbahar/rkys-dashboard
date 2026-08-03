import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { PlatformLogoutButton } from "@/components/platform/platform-logout-button";
import { PlatformShell } from "@/components/platform/platform-shell";
import { requirePlatformAdmin } from "@/lib/auth/platformGuard";
import { MODE_COOKIE, parseMode, type Mode } from "@/themes/mode";

export default async function PlatformDashboardLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  const t = await getTranslations("platform");

  // D88: koyu/açık tercihi cookie'den — client'ta okunsaydı ilk boyamada flaş olurdu.
  const mode: Mode = parseMode((await cookies()).get(MODE_COOKIE)?.value);

  return (
    <PlatformShell title={t("title")} mode={mode} logout={<PlatformLogoutButton />}>
      {children}
    </PlatformShell>
  );
}
