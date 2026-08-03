import { getLocale, getTranslations } from "next-intl/server";

import { CartBar } from "@/components/menu/cart-bar";
import { CartSessionSync } from "@/components/menu/cart-session-sync";
import { CategorySection } from "@/components/menu/category-section";
import { EndKioskSessionButton } from "@/components/menu/end-kiosk-session-button";
import { LanguageSwitcher } from "@/components/menu/language-switcher";
import { SessionPanel } from "@/components/menu/session-panel";
import type { Locale } from "@/i18n/locales";
import { getSessionCustomerId } from "@/lib/data/customers";
import { getEffectiveMenu, getEnabledLocales } from "@/lib/data/menu";
import { getKioskOrigin } from "@/lib/data/kiosk";
import { getSessionLoyaltyBalance } from "@/lib/data/loyalty";
import { getPickupCode } from "@/lib/data/pickup";
import { getSessionOrders } from "@/lib/data/sessionOrders";
import { getCurrentTenant } from "@/lib/data/tenant";
import { getCurrentGuestSession } from "@/lib/guest/session";
import { isEnabled } from "@/lib/modules/isEnabled";

import { applyCoupon } from "../masa/coupon-actions";
import { redeemLoyaltyPoints, requestLoyaltyOtp, verifyLoyaltyOtp } from "../masa/loyalty-actions";
import { submitOrder } from "../masa/actions";
import { endKioskSession } from "../kiosk/actions";

// Gel-Al: /masa'nın aynı menü/sepet/oturum bileşenlerini kullanır (kanal tek
// motoru, ARCHITECTURE #5) — Garson Çağır hariç (fiziksel masa yok, çağıracak
// garson kavramı anlamsız). Başlıkta "Bağlandı" yerine teslim kodu gösterilir.
export default async function PickupPage() {
  const guest = await getCurrentGuestSession();
  const t = await getTranslations("menu.pickup");

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
  const [categories, sessionOrders, enabledLocales, campaignsEnabled, crmLoyaltyEnabled, sessionCustomerId, pickupCode, kioskOrigin] =
    await Promise.all([
      getEffectiveMenu(guest.tenantId, guest.branchId, locale),
      getSessionOrders(guest.tableSessionId),
      getEnabledLocales(guest.tenantId),
      isEnabled(guest.tenantId, "campaigns"),
      isEnabled(guest.tenantId, "crm_loyalty"),
      getSessionCustomerId(guest.tableSessionId),
      getPickupCode(guest.tableSessionId),
      getKioskOrigin(guest.tableSessionId),
    ]);
  const loyaltyBalance = sessionCustomerId ? await getSessionLoyaltyBalance(sessionCustomerId) : 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-4 sm:p-8"
      style={{ paddingBottom: "var(--cart-bar-space)" }}>
      <CartSessionSync tableSessionId={guest.tableSessionId} />
      <header className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {pickupCode ? t("codeLabel", { code: pickupCode }) : t("connected")}
        </p>
        <div className="flex items-center gap-2">
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
          {kioskOrigin.isKiosk && kioskOrigin.pairingCode && (
            <EndKioskSessionButton pairingCode={kioskOrigin.pairingCode} endKioskSession={endKioskSession} />
          )}
        </div>
      </header>
      <div className="flex flex-col gap-8">
        {categories.map((category) => (
          <CategorySection key={category.id} category={category} currency={currency} />
        ))}
      </div>
      <CartBar currency={currency} onSubmit={submitOrder} />
    </main>
  );
}
