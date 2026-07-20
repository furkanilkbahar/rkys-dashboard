import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

// URL'de dil öneki YOK (kullanıcı kararı, 2026-07-19): QR menü linkleri
// subdomain'i zaten kullanıyor, dil bir de path'i uzatmasın. Locale bir
// cookie'de tutulur.
export const SUPPORTED_LOCALES = ["tr", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "tr";
export const LOCALE_COOKIE = "rkys-locale";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = SUPPORTED_LOCALES.includes(cookieLocale as Locale)
    ? (cookieLocale as Locale)
    : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`./${locale}/common.json`)).default,
  };
});