import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, LOCALE_COOKIE, SUPPORTED_LOCALES, type Locale } from "@/i18n/locales";

// URL'de dil öneki YOK (kullanıcı kararı, 2026-07-19): QR menü linkleri
// subdomain'i zaten kullanıyor, dil bir de path'i uzatmasın. Locale bir
// cookie'de tutulur.
export { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, type Locale };

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