import { getTranslations } from "next-intl/server";

import { setupDevice } from "../actions";
import { DeviceSetupForm } from "./device-setup-form";

export default async function TimeclockDeviceSetupPage() {
  const t = await getTranslations("timeclock.setup");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="max-w-sm text-center text-sm text-muted-foreground">{t("description")}</p>
      <DeviceSetupForm setupDevice={setupDevice} />
    </main>
  );
}
