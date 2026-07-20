// request.ts'ten ayrı tutulur: bu dosya next/headers gibi server-only API'ler
// içermez, client component'lerin de (dil seçici) güvenle import edebilmesi
// için (bkz. src/components/menu/language-switcher.tsx).
export const SUPPORTED_LOCALES = ["tr", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "tr";
export const LOCALE_COOKIE = "rkys-locale";
