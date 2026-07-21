import { notFound } from "next/navigation";

import { requireAdminActor } from "@/lib/auth/adminGuard";
import {
  getAdminCallTypes,
  getAdminLocales,
  getAdminModules,
  getAdminRatingSettings,
  getAdminTenantSettings,
  getAdminTipPresets,
} from "@/lib/data/adminSettings";

import {
  createCallType,
  createTipPreset,
  setDefaultLocale,
  toggleLocale,
  toggleModule,
  updateBusinessSettings,
  updateCallType,
  updateOrderSettings,
  updateRatingSettings,
  updateTipPreset,
} from "./actions";
import { SettingsManager } from "./settings-manager";

export default async function AdminSettingsPage() {
  const actor = await requireAdminActor();

  const [settings, callTypes, locales, tipPresets, ratingSettings, modules] = await Promise.all([
    getAdminTenantSettings(actor.tenantId),
    getAdminCallTypes(actor.tenantId),
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
      locales={locales}
      tipPresets={tipPresets}
      ratingSettings={ratingSettings}
      modules={modules}
      actions={{
        updateOrderSettings,
        updateBusinessSettings,
        createCallType,
        updateCallType,
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
