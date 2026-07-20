"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartLine = {
  key: string; // productId+variantId+sıralı extraIds birleşimi — aynı seçim tekrar eklenince miktar artar
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  unitPriceMinor: number;
  quantity: number;
  extraIds: string[];
  extraNames: string[];
};

type CartState = {
  tableSessionId: string | null;
  lines: CartLine[];
  setTableSessionId: (id: string) => void;
  addLine: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clear: () => void;
};

function lineKey(productId: string, variantId: string | null, extraIds: string[]): string {
  return `${productId}:${variantId ?? ""}:${[...extraIds].sort().join(",")}`;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      tableSessionId: null,
      lines: [],
      setTableSessionId: (id) =>
        set((state) =>
          // Farklı bir masa oturumuna geçildiyse (yeni QR taraması) eski
          // sepet geçerliliğini yitirir — RULES'ta zorunlu değil ama D30
          // "sepet koruması"nın yanlış oturuma taşınmaması için gerekli.
          state.tableSessionId && state.tableSessionId !== id
            ? { tableSessionId: id, lines: [] }
            : { tableSessionId: id },
        ),
      addLine: (line, quantity = 1) =>
        set((state) => {
          const existing = state.lines.find((l) => l.key === line.key);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.key === line.key ? { ...l, quantity: l.quantity + quantity } : l,
              ),
            };
          }
          return { lines: [...state.lines, { ...line, quantity }] };
        }),
      setQuantity: (key, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.key !== key)
              : state.lines.map((l) => (l.key === key ? { ...l, quantity } : l)),
        })),
      removeLine: (key) => set((state) => ({ lines: state.lines.filter((l) => l.key !== key) })),
      clear: () => set({ lines: [] }),
    }),
    { name: "rkys-cart" },
  ),
);

export { lineKey };
