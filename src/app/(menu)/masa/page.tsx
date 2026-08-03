import { getLocale, getTranslations } from "next-intl/server";

import { CartBar } from "@/components/menu/cart-bar";
import { CartSessionSync } from "@/components/menu/cart-session-sync";
import { CategorySection } from "@/components/menu/category-section";
import { CategoryStrip } from "@/components/menu/category-strip";
import { ConnectionIndicator } from "@/components/menu/connection-indicator";
import { LanguageSwitcher } from "@/components/menu/language-switcher";
import { RatingPrompt } from "@/components/menu/rating-prompt";
import { SessionPanel } from "@/components/menu/session-panel";
import { WaiterCallButton } from "@/components/menu/waiter-call-button";
import type { Locale } from "@/i18n/locales";
import { getCallTypes } from "@/lib/data/callTypes";
import { getSessionCustomerId } from "@/lib/data/customers";
import { getEffectiveMenu, getEnabledLocales } from "@/lib/data/menu";
import { getSessionLoyaltyBalance } from "@/lib/data/loyalty";
import { getGuestRatingSettings, getWaitersForRating, hasExistingRating } from "@/lib/data/ratings";
import { getSessionOrders } from "@/lib/data/sessionOrders";
import { getCurrentTenant } from "@/lib/data/tenant";
import { getCurrentGuestSession } from "@/lib/guest/session";
import { isEnabled } from "@/lib/modules/isEnabled";

import { submitOrder } from "./actions";
import { applyCoupon } from "./coupon-actions";
import { redeemLoyaltyPoints, requestLoyaltyOtp, verifyLoyaltyOtp } from "./loyalty-actions";

export default async function MenuPage() {
  const guest = await getCurrentGuestSession();
  const t = await getTranslations("menu.session");
  const tEmpty = await getTranslations("menu.menuEmpty");

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
  const [categories, callTypes, sessionOrders, enabledLocales, ratingSettings, campaignsEnabled, crmLoyaltyEnabled, sessionCustomerId] =
    await Promise.all([
      getEffectiveMenu(guest.tenantId, guest.branchId, locale),
      getCallTypes(guest.tenantId, locale),
      getSessionOrders(guest.tableSessionId),
      getEnabledLocales(guest.tenantId),
      getGuestRatingSettings(guest.tenantId),
      isEnabled(guest.tenantId, "campaigns"),
      isEnabled(guest.tenantId, "crm_loyalty"),
      getSessionCustomerId(guest.tableSessionId),
    ]);
  const [waiters, alreadyRated] = ratingSettings.isEnabled
    ? await Promise.all([getWaitersForRating(guest.tenantId), hasExistingRating(guest.tableSessionId)])
    : [[], false];
  const loyaltyBalance = sessionCustomerId ? await getSessionLoyaltyBalance(sessionCustomerId) : 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-4 sm:p-8"
      style={{ paddingBottom: "var(--cart-bar-space)" }}>
      <CartSessionSync tableSessionId={guest.tableSessionId} />
      <RatingPrompt
        tableSessionId={guest.tableSessionId}
        isEnabled={ratingSettings.isEnabled}
        googleReviewUrl={ratingSettings.googleReviewUrl}
        waiters={waiters}
        alreadyRated={alreadyRated}
      />
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <ConnectionIndicator />
        <div className="flex shrink-0 items-center gap-2">
          <SessionPanel
            tableSessionId={guest.tableSessionId}
            currency={currency}
            initialOrders={sessionOrders}
            campaignsEnabled={campaignsEnabled}
            applyCoupon={applyCoupon}
            crmLoyaltyEnabled={crmLoyaltyEnabled}
            sessionCustomerId={sessionCustomerId}
            loyaltyBalance={loyaltyBalance}
            requestLoyaltyOtp={requestLoyaltyOtp}
            verifyLoyaltyOtp={verifyLoyaltyOtp}
            redeemLoyaltyPoints={redeemLoyaltyPoints}
          />
          <LanguageSwitcher enabledLocales={enabledLocales as Locale[]} />
        </div>
      </header>
      <CategoryStrip categories={categories.map((c) => ({ id: c.id, name: c.name }))} />

      {categories.length === 0 ? (
        /* Adım 0 kabul kriteri 3 — boş menü tasarımsız kalmaz. */
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <h2
            className="font-[family-name:var(--t-display)]"
            style={{
              fontWeight: "var(--t-display-w)",
              letterSpacing: "var(--t-display-tr)",
              fontSize: "var(--t-display-s)",
            }}
          >
            {tEmpty("title")}
          </h2>
          <p className="max-w-[38ch] text-sm leading-relaxed text-[var(--fg-muted)]">{tEmpty("body")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {categories.map((category, index) => (
            <CategorySection
              key={category.id}
              category={category}
              currency={currency}
              isFirst={index === 0}
            />
          ))}
        </div>
      )}
      <CartBar currency={currency} onSubmit={submitOrder} trailing={<WaiterCallButton callTypes={callTypes} />} />
    </main>
  );
}
