"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

type State = "online" | "reconnecting" | "offline";

/* ── Modül düzeyi harici store ────────────────────────────────────────────
   Bağlantı durumu React'in DIŞINDA yaşayan bir şey (window event'leri), o
   yüzden useSyncExternalStore ile okunuyor. Efekt içinde setState çağırmak
   (cascading render) gerekmiyor — "reconnecting" ara durumu da store'un
   içinde yönetiliyor.
   ─────────────────────────────────────────────────────────────────────── */
let state: State = "online";
let timer: number | undefined;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function set(next: State) {
  if (state === next) return;
  state = next;
  emit();
}

function handleOnline() {
  // Ağ geri geldi ama senkron bitmedi — kısa bir "yeniden bağlanılıyor"
  // penceresi kullanıcıya sepetin gönderilmekte olduğunu anlatır (D30).
  window.clearTimeout(timer);
  set("reconnecting");
  timer = window.setTimeout(() => set("online"), 1200);
}

function handleOffline() {
  window.clearTimeout(timer);
  set("offline");
}

function subscribe(onStoreChange: () => void) {
  if (listeners.size === 0) {
    state = navigator.onLine ? "online" : "offline";
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  }
  listeners.add(onStoreChange);

  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0) {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearTimeout(timer);
    }
  };
}

const getSnapshot = (): State => state;
// SSR'da navigator yok — sunucu "online" varsayar, hidrasyondan sonra gerçek
// durum okunur. Hidrasyon uyumsuzluğu üretmez.
const getServerSnapshot = (): State => "online";

/**
 * Faz 21 Adım 0 kabul kriteri 3 + 4 — D30 bağlantı göstergesi.
 *
 * Önceki tasarımda menü başlığında sabit bir "Bağlı" metni vardı; gerçek
 * bağlantı durumunu hiç yansıtmıyordu. D30'un ürün vaadi (kafe Wi-Fi'si
 * kesilir, sepet korunur, bağlantı gelince gönderilir) kullanıcıya
 * görünmüyordu.
 *
 * Durum değişimi ANİMASYONLA anlatılır (kabul kriteri 4): nokta renk geçişi
 * yapar, çevrimdışına düşerken açıklama satırı açılır. prefers-reduced-motion
 * altında geçiş global kuralla sadeleşir — bilgi kaybolmaz.
 */
export function ConnectionIndicator() {
  const t = useTranslations("menu.connection");
  const connection = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const dotColor =
    connection === "online"
      ? "var(--sem-ok)"
      : connection === "reconnecting"
        ? "var(--sem-warn)"
        : "var(--sem-err)";

  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-center gap-2 text-xs text-[var(--fg-muted)]" role="status" aria-live="polite">
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)]"
          style={{ backgroundColor: dotColor }}
        />
        {t(connection)}
      </p>
      {connection === "offline" && (
        <p className="max-w-[34ch] text-[11px] leading-snug text-[var(--fg-faint)]">{t("offlineHint")}</p>
      )}
    </div>
  );
}
