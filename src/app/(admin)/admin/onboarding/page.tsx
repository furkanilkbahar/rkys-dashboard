import { redirect } from "next/navigation";

import { requireAdminActor } from "@/lib/auth/adminGuard";
import { getDefaultBranchId } from "@/lib/data/branch";
import { isOnboardingCompleted } from "@/lib/data/onboarding";

import { toggleLocale, toggleModule, updateBusinessSettings } from "@/app/(admin)/admin/(dashboard)/settings/actions";
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

  return (
    <OnboardingWizard
      isOwner={actor.role === "owner"}
      branchId={branchId}
      actions={{
        clearDemoData,
        applyMenuTemplate,
        createOnboardingTables,
        uploadTenantLogo,
        completeOnboarding,
        toggleLocale,
        toggleModule,
        updateBusinessSettings,
      }}
    />
  );
}
