"use client";

import { useSyncExternalStore } from "react";

import type { OpsTone } from "@/components/ops/ops-board";

/**
 * Faz 21 Adım 3 — fiş yaşlanması.
 *
 * KDS'de en değerli tek sinyal "bu fiş ne kadardır bekliyor". `createdAt`
 * zaten `StaffOrderView` içinde geliyordu ama hiçbir yerde gösterilmiyordu.
 *
 * Zaman React'in dışında akan bir şey → `useSyncExternalStore`. Efekt içinde
 * `setState` çağıran bir sayaç yazılmaz (`react-hooks/set-state-in-effect`),
 * ayrıca tek bir `setInterval` tüm kartları besler.
 *
 * `getServerSnapshot` 0 döner: sunucu saati ile istemci saati arasındaki fark
 * hidrasyon uyumsuzluğu üretmesin diye süre yalnızca istemcide hesaplanır,
 * ilk boyamada rozet hiç çizilmez (CLS üretmemesi için rozet satırı zaten
 * sabit yükseklikte).
 */
const TICK_MS = 30_000;

let nowMs = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  if (listeners.size === 0) {
    nowMs = Date.now();
    timer = setInterval(() => {
      nowMs = Date.now();
      for (const listener of listeners) listener();
    }, TICK_MS);
  }
  listeners.add(onStoreChange);

  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const getSnapshot = () => nowMs;
const getServerSnapshot = () => 0;

/** Dakikada iki kez tazelenen ortak "şimdi". Hidrasyondan önce 0. */
export function useNowMs(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Hidrasyondan önce (veya bozuk tarihte) `null` — çağıran rozeti çizmez. */
export function elapsedMinutes(createdAtIso: string, now: number): number | null {
  if (now === 0) return null;
  const startedAt = Date.parse(createdAtIso);
  if (Number.isNaN(startedAt)) return null;
  return Math.max(0, Math.floor((now - startedAt) / 60_000));
}

/**
 * Yaşlanma eşikleri. Servis hedefi mutfaktan mutfağa değişir; v1'de tek
 * değer, tenant başına ayarlanabilir hale getirmek ayrı bir karar (modül
 * ayarı) gerektirir — burada uydurulmaz, sabit ve belgelenmiş kalır.
 */
export const AGING_WARN_MINUTES = 10;
export const AGING_ERR_MINUTES = 20;

export function agingTone(minutes: number | null): OpsTone {
  if (minutes === null) return "neutral";
  if (minutes >= AGING_ERR_MINUTES) return "err";
  if (minutes >= AGING_WARN_MINUTES) return "warn";
  return "neutral";
}
