import { notFound } from "next/navigation";

import { requireAdminActor } from "@/lib/auth/adminGuard";
import {
  getAdminCallTypes,
  getAdminLocales,
  getAdminModules,
  getAdminRatingSettings,
  getAdminReasonCodes,
  getAdminTenantSettings,
  getAdminTipPresets,
  getPublicThemes,
} from "@/lib/data/adminSettings";
import { getAdminBranchesInfo } from "@/lib/data/branch";
import { getReportSchedules } from "@/lib/data/reportSchedules";

import {
  createBranch,
  createCallType,
  createReasonCode,
  createReportSchedule,
  createTipPreset,
  deleteReportSchedule,
  requestAccountDeletion,
  sendReportNow,
  setDefaultLocale,
  toggleLocale,
  toggleModule,
  toggleReportSchedule,
  updateBusinessSettings,
  updateCallType,
  updateOrderSettings,
  updateRatingSettings,
  updateReasonCode,
  updateTheme,
  updateTipPreset,
} from "./actions";
import { SettingsManager } from "./settings-manager";

export default async function AdminSettingsPage() {
  const actor = await requireAdminActor();

  const [settings, callTypes, reasonCodes, locales, tipPresets, ratingSettings, modules, branchesInfo, reportSchedules, themes] =
    await Promise.all([
      getAdminTenantSettings(actor.tenantId),
      getAdminCallTypes(actor.tenantId),
      getAdminReasonCodes(actor.tenantId),
      getAdminLocales(actor.tenantId),
      getAdminTipPresets(actor.tenantId),
      getAdminRatingSettings(actor.tenantId),
      getAdminModules(actor.tenantId),
      getAdminBranchesInfo(actor.tenantId),
      getReportSchedules(actor.tenantId),
      getPublicThemes(),
    ]);

  if (!settings || !ratingSettings) {
    notFound();
  }

  return (
    <SettingsManager
      isOwner={actor.role === "owner"}
      settings={settings}
      callTypes={callTypes}
      reasonCodes={reasonCodes}
      locales={locales}
      tipPresets={tipPresets}
      ratingSettings={ratingSettings}
      modules={modules}
      branchesInfo={branchesInfo}
      reportSchedules={reportSchedules}
      themes={themes}
      actions={{
        updateOrderSettings,
        updateBusinessSettings,
        updateTheme,
        createCallType,
        updateCallType,
        createReasonCode,
        updateReasonCode,
        toggleLocale,
        setDefaultLocale,
        createTipPreset,
        updateTipPreset,
        updateRatingSettings,
        toggleModule,
        createBranch,
        requestAccountDeletion,
        createReportSchedule,
        toggleReportSchedule,
        deleteReportSchedule,
        sendReportNow,
      }}
    />
  );
}
