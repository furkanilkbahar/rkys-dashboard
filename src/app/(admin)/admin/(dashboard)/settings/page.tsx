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
import { getFiscalDailySummary } from "@/lib/data/fiscal";
import { getReportSchedules } from "@/lib/data/reportSchedules";
import { todayIsoInTimezone } from "@/lib/utils/timezone";

import {
  createBranch,
  createCallType,
  createReasonCode,
  createReportSchedule,
  createTipPreset,
  deleteReportSchedule,
  requestAccountDeletion,
  requestModule,
  purchaseModuleAddon,
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

  const fiscalEnabled = modules.some((m) => m.moduleKey === "fiscal_integration" && m.isEnabled);
  const fiscalSummary = fiscalEnabled
    ? await getFiscalDailySummary(todayIsoInTimezone(settings.timezone))
    : null;

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
      fiscalSummary={fiscalSummary}
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
        requestModule,
        purchaseModuleAddon,
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
