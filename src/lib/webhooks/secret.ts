import "server-only";

import { randomBytes } from "node:crypto";

/**
 * Webhook secret'ı API key'in aksine HASH'lenmez — sunucu her teslimatta
 * bu değeri kullanarak HMAC imzası ÜRETİR (dispatch_webhook_deliveries,
 * 0065), bu yüzden düz metin saklanır ve tenant panelde tekrar görüntüleyip
 * kendi tarafında doğrulama yapabilir (Stripe'ın signing secret modeliyle
 * aynı yaklaşım — API key'in tek seferlik gösterimiyle karıştırılmamalı).
 */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}
