import "server-only";

import { mockMarketplaceProvider } from "./mock";
import type { MarketplaceProvider } from "./provider";

export type { MarketplaceOrderItem, MarketplaceProvider, ParsedMarketplaceOrder } from "./provider";

const PROVIDERS: Record<string, MarketplaceProvider> = {
  mock: mockMarketplaceProvider,
};

export function getMarketplaceProvider(name: string): MarketplaceProvider | null {
  return PROVIDERS[name] ?? null;
}
