import { redirect } from "next/navigation";

import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getAdminTenantSettings, getPublicThemes } from "@/lib/data/adminSettings";
import { getDefaultBranchId } from "@/lib/data/branch";
import { isOnboardingCompleted } from "@/lib/data/onboarding";

import { toggleLocale, toggleModule, updateBusinessSettings, updateTheme } from "@/app/(admin)/admin/(dashboard)/settings/actions";
import {
  applyMenuTemplate,
  clearDemoData,
  completeOnboarding,
  createOnboardingTables,
  uploadTenantLogo,
} from "./actions";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const actor = await requireAdminActor();

  if (await isOnboardingCompleted(actor.tenantId)) {
    redirect("/admin");
  }

  const branchId = await getDefaultBranchId(actor.tenantId);
  if (!branchId) {
    redirect("/admin/login");
  }

  const [themes, settings] = await Promise.all([getPublicThemes(), getAdminTenantSettings(actor.tenantId)]);

  return (
    <OnboardingWizard
      isOwner={actor.role === "owner"}
      branchId={branchId}
      themes={themes}
      themeKey={settings?.themeKey ?? "warm-luxury"}
      actions={{
        clearDemoData,
        applyMenuTemplate,
        createOnboardingTables,
        uploadTenantLogo,
        completeOnboarding,
        toggleLocale,
        toggleModule,
        updateBusinessSettings,
        updateTheme,
      }}
    />
  );
}
