import type { MarketplaceProvider, ParsedMarketplaceOrder } from "./provider";

// Yerel/test ortamı ve gerçek sağlayıcı entegrasyonu henüz kurulmadığı
// sürece varsayılan sağlayıcı: gövdeyi doğrudan ParsedMarketplaceOrder
// şekliyle bekler (aracı platformların normalize edilmiş webhook formatını
// simüle eder). Gerçek Posentegra/Yemeksepeti/Trendyol adaptörü D70'in
// kademeli geçiş planına göre eklendiğinde bu dosyanın yanına yeni bir
// provider.ts implementasyonu (payments/iyzico.ts örneği) konur.
export const mockMarketplaceProvider: MarketplaceProvider = {
  name: "mock",
  parseIncomingOrder(rawBody: string): ParsedMarketplaceOrder | null {
    try {
      const body = JSON.parse(rawBody) as {
        externalOrderId?: unknown;
        items?: unknown;
      };
      if (typeof body.externalOrderId !== "string" || !Array.isArray(body.items) || body.items.length === 0) {
        return null;
      }
      const items = body.items.map((item) => {
        const record = item as Record<string, unknown>;
        if (
          typeof record.externalSku !== "string" ||
          typeof record.quantity !== "number" ||
          typeof record.unitPriceMinor !== "number" ||
          typeof record.name !== "string"
        ) {
          throw new Error("invalid item");
        }
        return {
          externalSku: record.externalSku,
          quantity: record.quantity,
          unitPriceMinor: record.unitPriceMinor,
          name: record.name,
        };
      });
      return { externalOrderId: body.externalOrderId, items };
    } catch {
      return null;
    }
  },
};
