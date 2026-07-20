"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";

import { LOCALE_COOKIE, SUPPORTED_LOCALES, type Locale } from "@/i18n/locales";
import { cn } from "@/lib/utils/cn";

// next-intl'in de okuduğu aynı çerez — UI chrome ve menü içeriği tek dil
// seçiciyle birlikte döner. Modül seviyesinde, bileşenin dışında tutulur.
function setLocaleCookie(nextLocale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
}

export function LanguageSwitcher() {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  function handleChange(nextLocale: Locale) {
    if (nextLocale === locale) return;
    setLocaleCookie(nextLocale);
    startTransition(() => {
      window.location.reload();
    });
  }

  return (
    <div className="flex gap-1" role="group" aria-label="language">
      {SUPPORTED_LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => handleChange(code)}
          disabled={isPending}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            code === locale
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent",
          )}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
