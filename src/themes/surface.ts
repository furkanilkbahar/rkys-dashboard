/**
 * Faz 21 / D88 — token yüzeyi (surface) türetmesi.
 *
 * Token kapsamlaması `<html data-surface>` üzerinden yapılır; hangi katmanın
 * geçerli olacağını route belirler:
 *
 *   guest     → Katman 1, tenant teması  (`(menu)`: masa/paket/teslimat/rezervasyon/kiosk)
 *   app       → Katman 2b, uygulama chrome'u, çift modlu (admin/platform/waiter/kitchen/cashier/courier/vardiya)
 *   marketing → Katman 2a, pazarlama
 *
 * Sarmalayıcı `<div>` yerine `<html>` kullanılmasının nedeni: dropdown-menu,
 * select ve sheet primitive'leri Base UI Portal ile `document.body`'ye render
 * oluyor — subtree'ye konan token'ları göremezlerdi.
 */

export const SURFACES = ["guest", "app", "marketing"] as const;
export type Surface = (typeof SURFACES)[number];

export const SURFACE_HEADER = "x-rkys-surface";

/** Misafir (girişsiz, tenant temalı) yüzeyler — `(menu)` route grubu. */
const GUEST_PREFIXES = ["/masa", "/paket", "/teslimat", "/rezervasyon", "/kiosk"] as const;

/** Kök domainde bile uygulama chrome'u sayılan yüzeyler. */
const ROOT_APP_PREFIXES = ["/platform"] as const;

function hasPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Pathname + domain tipinden yüzeyi türetir.
 *
 * @param pathname İstek yolu (`request.nextUrl.pathname`).
 * @param isRootDomain Kök domain mi (tenant subdomain'i değil) — pazarlama/platform.
 */
export function resolveSurface(pathname: string, isRootDomain: boolean): Surface {
  if (isRootDomain) {
    return hasPrefix(pathname, ROOT_APP_PREFIXES) ? "app" : "marketing";
  }
  return hasPrefix(pathname, GUEST_PREFIXES) ? "guest" : "app";
}

export function isSurface(value: string | null | undefined): value is Surface {
  return value !== null && value !== undefined && (SURFACES as readonly string[]).includes(value);
}
