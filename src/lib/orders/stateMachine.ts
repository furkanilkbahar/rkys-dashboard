export const ORDER_STATUSES = ["pending", "approved", "preparing", "ready", "served", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// D22 karma iptal: pending/approved serbestçe iptal edilir; preparing sonrası
// doğrudan iptal yok, yalnızca istek+garson onayı akışı (Adım 5 RPC'leri).
// Gerçek kapı RPC'lerdedir (RULES #24) — bu, UI'ın buton göstermek için
// kullandığı saf bir ayna, tek başına yetki kaynağı değildir.
const LEGAL_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["approved", "cancelled"],
  approved: ["preparing", "cancelled"],
  preparing: ["ready"],
  ready: ["served"],
  served: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

export function canGuestCancelDirectly(status: OrderStatus): boolean {
  return status === "pending" || status === "approved";
}

export function canGuestRequestCancellation(status: OrderStatus): boolean {
  return status === "preparing";
}
