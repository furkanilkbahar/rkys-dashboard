import "server-only";

import { headers } from "next/headers";

export type CurrentTenant = {
  id: string;
  slug: string;
  currency: string;
};

/**
 * Middleware'in enjekte ettiği x-rkys-tenant-* header'larını okur — Server
 * Component'lerin tenant context'ine erişeceği tek nokta (ARCHITECTURE.md #1).
 * Kök domainde (marketing/platform) header yoktur, null döner.
 */
export async function getCurrentTenant(): Promise<CurrentTenant | null> {
  const headerStore = await headers();
  const id = headerStore.get("x-rkys-tenant-id");
  const slug = headerStore.get("x-rkys-tenant-slug");
  const currency = headerStore.get("x-rkys-tenant-currency");

  if (!id || !slug || !currency) {
    return null;
  }

  return { id, slug, currency };
}