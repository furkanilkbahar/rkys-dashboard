import "server-only";

import { redirect } from "next/navigation";

import { getCurrentPlatformAdmin, type CurrentPlatformAdmin } from "./platformSession";

/**
 * Süper Admin paneli için ortak giriş kontrolü — requireAdminActor()
 * (personel) ile aynı desen, ayrı bir claim/route üzerinden.
 */
export async function requirePlatformAdmin(): Promise<CurrentPlatformAdmin> {
  const admin = await getCurrentPlatformAdmin();

  if (!admin) {
    redirect("/platform/login");
  }

  return admin;
}
