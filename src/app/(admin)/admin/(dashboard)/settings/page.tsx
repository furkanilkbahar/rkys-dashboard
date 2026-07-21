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
} from "@/lib/data/adminSettings";

import {
  createCallType,
  createReasonCode,
  createTipPreset,
  setDefaultLocale,
  toggleLocale,
  toggleModule,
  updateBusinessSettings,
  updateCallType,
  updateOrderSettings,
  updateRatingSettings,
  updateReasonCode,
  updateTipPreset,
} from "./actions";
import { SettingsManager } from "./settings-manager";

export default async function AdminSettingsPage() {
  const actor = await requireAdminActor();

  const [settings, callTypes, reasonCodes, locales, tipPresets, ratingSettings, modules] = await Promise.all([
    getAdminTenantSettings(actor.tenantId),
    getAdminCallTypes(actor.tenantId),
    getAdminReasonCodes(actor.tenantId),
    getAdminLocales(actor.tenantId),
    getAdminTipPresets(actor.tenantId),
    getAdminRatingSettings(actor.tenantId),
    getAdminModules(actor.tenantId),
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
      actions={{
        updateOrderSettings,
        updateBusinessSettings,
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
      }}
    />
  );
}
