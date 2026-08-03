"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { MODE_COOKIE, type Mode } from "./mode";

/**
 * Faz 21 / D88 — koyu/açık mod tercihi COOKIE'de tutulur, localStorage'da değil.
 *
 * Client'ta okunsaydı kök layout ilk boyamada modu bilemez, sayfa koyu
 * varsayılanla çizilip sonra açığa atlardı (beyaz flaş). Cookie sunucuda
 * okunduğu için `<html data-mode>` doğru değerle render edilir ve tema
 * değiştirmek için hiç client JS gerekmez.
 *
 * NOT: `"use server"` dosyaları yalnızca async fonksiyon export edebilir —
 * sabitler ve tipler `./mode.ts`'te.
 */
export async function setMode(mode: Mode): Promise<void> {
  const store = await cookies();
  store.set(MODE_COOKIE, mode, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
  revalidatePath("/", "layout");
}
