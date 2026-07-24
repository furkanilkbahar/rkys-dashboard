import { z } from "zod";

export const MARKETPLACE_PROVIDERS = ["mock"] as const;
export type MarketplaceProviderName = (typeof MARKETPLACE_PROVIDERS)[number];

export const mappingFormSchema = z.object({
  provider: z.enum(MARKETPLACE_PROVIDERS),
  externalSku: z.string().min(1),
  productId: z.uuid(),
});
export type MappingFormInput = z.infer<typeof mappingFormSchema>;

export type MarketplaceActionResult = { ok: true } | { ok: false; error: "invalid_input" | "forbidden" | "not_enabled" | "unknown" };
