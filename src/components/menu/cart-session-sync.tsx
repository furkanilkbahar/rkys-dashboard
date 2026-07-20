"use client";

import { useEffect } from "react";

import { useCartStore } from "@/lib/store/cart";

// Sepet farklı bir masa oturumuna (yeni QR taraması) taşınmasın diye
// tableSessionId'yi store'a yazar — bkz. useCartStore.setTableSessionId.
export function CartSessionSync({ tableSessionId }: { tableSessionId: string }) {
  const setTableSessionId = useCartStore((state) => state.setTableSessionId);

  useEffect(() => {
    setTableSessionId(tableSessionId);
  }, [tableSessionId, setTableSessionId]);

  return null;
}
