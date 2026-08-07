import { describe, expect, it } from "vitest";

import { isSubscriptionGateExempt } from "../../../src/proxy";

/**
 * D101: abonelik kapısı, tenant_status kapısının aksine tenant'ı TAM
 * kapatmaz — kapatsaydı kullanıcı borcunu ödeyebileceği ekrana da ulaşamaz,
 * yani kilidi açmanın hiçbir yolu kalmazdı.
 */
describe("abonelik kapısı muafiyetleri", () => {
  it("ödeyip geri dönüş yolu açık: giriş, abonelik sayfası ve webhook'lar", () => {
    expect(isSubscriptionGateExempt("/admin/login")).toBe(true);
    expect(isSubscriptionGateExempt("/admin/billing")).toBe(true);
    expect(isSubscriptionGateExempt("/admin/billing/mock/abc-123")).toBe(true);
    expect(isSubscriptionGateExempt("/api/webhooks/subscriptions/iyzico")).toBe(true);
  });

  it("işletme yüzeylerinin tamamı kapanır — misafir QR menüsü dahil", () => {
    expect(isSubscriptionGateExempt("/admin")).toBe(false);
    expect(isSubscriptionGateExempt("/admin/tables")).toBe(false);
    expect(isSubscriptionGateExempt("/masa/abc")).toBe(false);
    expect(isSubscriptionGateExempt("/waiter")).toBe(false);
    expect(isSubscriptionGateExempt("/kitchen")).toBe(false);
    expect(isSubscriptionGateExempt("/")).toBe(false);
  });

  it("webhook muafiyeti dar: Tenant API ödemeyen tenant'ta çalışmaya devam etmez", () => {
    expect(isSubscriptionGateExempt("/api/v1/orders")).toBe(false);
    expect(isSubscriptionGateExempt("/api/menu")).toBe(false);
  });

  it("önek eşleşmesi sınırda sızdırmaz", () => {
    // "/admin/billing-export" gibi bir yol muafiyetin içine düşmemeli.
    expect(isSubscriptionGateExempt("/admin/billing-export")).toBe(false);
    expect(isSubscriptionGateExempt("/admin/login-as")).toBe(false);
  });
});
