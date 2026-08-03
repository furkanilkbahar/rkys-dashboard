/**
 * Faz 21 / D88 — koyu/açık mod sabitleri.
 *
 * Server action dosyaları (`"use server"`) YALNIZCA async fonksiyon export
 * edebilir; sabit ve tipler bu bağımsız modülde durur. Hem kök layout (sunucu)
 * hem `mode-actions.ts` buradan okur.
 */
export const MODE_COOKIE = "rkys-mode";

export type Mode = "dark" | "light";

/** Cookie değerini güvenli biçimde moda çevirir; bilinmeyen değer koyuya düşer. */
export function parseMode(value: string | undefined): Mode {
  return value === "light" ? "light" : "dark";
}
