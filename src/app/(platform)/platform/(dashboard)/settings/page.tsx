import { getPlatformSettings } from "@/lib/data/platformSettings";

import { SettingsManager } from "./settings-manager";

export default async function PlatformSettingsPage() {
  const settings = await getPlatformSettings();

  return <SettingsManager enforce2fa={settings.enforce2fa} autoApproveRegistrations={settings.autoApproveRegistrations} />;
}
