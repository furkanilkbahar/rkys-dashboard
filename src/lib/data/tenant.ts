import "server-only";

import { headers } from "next/headers";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export type CurrentTenant = {
  id: string;
  slug: string;
  name: string;
  currency: string;
  themeKey: string;
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
  const name = headerStore.get("x-rkys-tenant-name");
  const currency = headerStore.get("x-rkys-tenant-currency");
  const themeKey = headerStore.get("x-rkys-tenant-theme");

  if (!id || !slug || !name || !currency || !themeKey) {
    return null;
  }

  return { id, slug, name, currency, themeKey };
}

/**
 * Admin panelinde firma adını göstermek için — getCurrentTenant() domain
 * bazlı (kök/marketing domain'de, ör. henüz custom domain bağlanmamış tenant'ta,
 * header hiç yok, null döner). Oturum sahibi zaten actor.tenantId'yi biliyor;
 * bu sorgu RLS (tenants_select_own) ile korunur, hangi domainden erişildiğinden
 * bağımsız çalışır.
 */
export async function getAdminTenantName(tenantId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("tenants").select("name").eq("id", tenantId).single();
  return data?.name ?? null;
}

/**
 * Misafir tarafı (oturumsuz, rezervasyon talebi formu gibi) tenant saat
 * dilimini okumak için — getCurrentTenant()'ın header'ları timezone
 * taşımıyor, misafirin hiç Supabase oturumu yok (RLS bypass gerekir).
 */
export async function getTenantTimezone(tenantId: string): Promise<string> {
  const service = createServiceRoleClient();
  const { data } = await service.from("tenants").select("timezone").eq("id", tenantId).single();
  return data?.timezone ?? "UTC";
}