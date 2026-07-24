// Sağlayıcı-agnostik pazar yeri (marketplace) yazma-API arayüzü — D70 karma
// strateji: aracı katman (Posentegra/Entegre App sınıfı) ile hızlı çıkış,
// Yemeksepeti/Trendyol'un doğrudan bağlantılarına kademeli geçiş; her ikisi
// de bu arayüze karşı yeni bir adaptör (mock.ts örneği) olarak eklenir.
// lib/payments/provider.ts ile aynı desen (ARCHITECTURE.md #4).

export type MarketplaceOrderItem = {
  externalSku: string;
  quantity: number;
  unitPriceMinor: number;
  name: string;
};

export type ParsedMarketplaceOrder = {
  externalOrderId: string;
  items: MarketplaceOrderItem[];
};

export interface MarketplaceProvider {
  readonly name: string;
  /** İmza/format geçersizse null döner — çağıran taraf bunu 400 olarak işler. */
  parseIncomingOrder(rawBody: string): ParsedMarketplaceOrder | null;
}
