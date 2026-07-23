import { getLocale, getTranslations } from "next-intl/server";

import { CartBar } from "@/components/menu/cart-bar";
import { CartSessionSync } from "@/components/menu/cart-session-sync";
import { CategorySection } from "@/components/menu/category-section";
import { LanguageSwitcher } from "@/components/menu/language-switcher";
import { RatingPrompt } from "@/components/menu/rating-prompt";
import { SessionPanel } from "@/components/menu/session-panel";
import { WaiterCallButton } from "@/components/menu/waiter-call-button";
import type { Locale } from "@/i18n/locales";
import { getCallTypes } from "@/lib/data/callTypes";
import { getEffectiveMenu, getEnabledLocales } from "@/lib/data/menu";
import { getGuestRatingSettings, getWaitersForRating, hasExistingRating } from "@/lib/data/ratings";
import { getSessionOrders } from "@/lib/data/sessionOrders";
import { getCurrentTenant } from "@/lib/data/tenant";
import { getCurrentGuestSession } from "@/lib/guest/session";
import { isEnabled } from "@/lib/modules/isEnabled";

import { submitOrder } from "./actions";
import { applyCoupon } from "./coupon-actions";

export default async function MenuPage() {
  const guest = await getCurrentGuestSession();
  const t = await getTranslations("menu.session");

  if (!guest) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("noSession")}</p>
      </main>
    );
  }

  const locale = await getLocale();
  const tenant = await getCurrentTenant();
  const currency = tenant?.currency ?? "TRY";
  const [categories, callTypes, sessionOrders, enabledLocales, ratingSettings, campaignsEnabled] = await Promise.all([
    getEffectiveMenu(guest.tenantId, guest.branchId, locale),
    getCallTypes(guest.tenantId, locale),
    getSessionOrders(guest.tableSessionId),
    getEnabledLocales(guest.tenantId),
    getGuestRatingSettings(guest.tenantId),
    isEnabled(guest.tenantId, "campaigns"),
  ]);
  const [waiters, alreadyRated] = ratingSettings.isEnabled
    ? await Promise.all([getWaitersForRating(guest.tenantId), hasExistingRating(guest.tableSessionId)])
    : [[], false];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-4 pb-24 sm:p-8">
      <CartSessionSync tableSessionId={guest.tableSessionId} />
      <RatingPrompt
        tableSessionId={guest.tableSessionId}
        isEnabled={ratingSettings.isEnabled}
        googleReviewUrl={ratingSettings.googleReviewUrl}
        waiters={waiters}
        alreadyRated={alreadyRated}
      />
      <header className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{t("connected")}</p>
        <div className="flex items-center gap-2">
          <SessionPanel
            tableSessionId={guest.tableSessionId}
            currency={currency}
            initialOrders={sessionOrders}
            campaignsEnabled={campaignsEnabled}
            applyCoupon={applyCoupon}
          />
          <LanguageSwitcher enabledLocales={enabledLocales as Locale[]} />
        </div>
      </header>
      <div className="flex flex-col gap-8">
        {categories.map((category) => (
          <CategorySection key={category.id} category={category} currency={currency} />
        ))}
      </div>
      <WaiterCallButton callTypes={callTypes} />
      <CartBar currency={currency} onSubmit={submitOrder} />
    </main>
  );
}
